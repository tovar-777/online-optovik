import { sb, sbAnon } from '../lib/supabase.js';

// ── Draft auto-save ─────────────────────────────────────────

/**
 * Build order items array from cart + products.
 */
function buildOrderItems(cart, products) {
  return Object.keys(cart).map((pid) => {
    const it = cart[pid];
    const p = products.find((x) => x.id === pid) || {};
    const qty = it.quantity || 0;
    const price = parseFloat(p.price || 0);
    return {
      product_id: pid,
      product_name: p.cartName || p.name || pid,
      price,
      quantity: qty,
      unit: p.unit || 'шт',
      total: parseFloat((price * qty).toFixed(2)),
      added_at: it.timestamp || new Date().toISOString(),
      comment: it.comment || '',
      storage: p.storage || null,
    };
  });
}

/**
 * Save draft order to Supabase.
 * For code-mode users: uses RPC `upsert_code_draft` (SECURITY DEFINER).
 * For email users: direct table operations.
 */
export async function saveDraft({ cart, products, codeSession, currentUser, draftOrderId }) {
  const client = sb;
  if (!client) return { draftOrderId };
  if (!Object.keys(cart).length) return { draftOrderId };

  const items = buildOrderItems(cart, products);
  const total = items.reduce((s, i) => s + i.total, 0);

  if (codeSession) {
    // Code users: SECURITY DEFINER RPC
    const rpc = await client.rpc('upsert_code_draft', {
      p_user_email: codeSession.phone || '',
      p_user_name: codeSession.name || '',
      p_user_location: codeSession.delivery_address || '',
      p_total_amount: total,
      p_items: items,
      p_draft_id: draftOrderId || null,
      p_client_id: codeSession.id || null,
    });
    if (rpc.error) throw new Error(rpc.error.message);
    return { draftOrderId: rpc.data || draftOrderId };
  }

  if (draftOrderId) {
    // Update existing draft
    await client.from('orders').update({ total_amount: total, updated_at: new Date().toISOString() }).eq('id', draftOrderId).eq('status', 'draft');
    await client.from('order_items').delete().eq('order_id', draftOrderId);
    await client.from('order_items').insert(items.map((i) => ({ ...i, order_id: draftOrderId })));
    return { draftOrderId };
  }

  if (currentUser) {
    // Check for existing draft
    const existing = await client.from('orders').select('id').eq('user_id', currentUser.id).eq('status', 'draft').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (existing.data) {
      const id = existing.data.id;
      await client.from('orders').update({ total_amount: total, updated_at: new Date().toISOString() }).eq('id', id);
      await client.from('order_items').delete().eq('order_id', id);
      await client.from('order_items').insert(items.map((i) => ({ ...i, order_id: id })));
      return { draftOrderId: id };
    }
    // Create new draft
    const ins = await client.from('orders').insert({ user_id: currentUser.id, user_email: currentUser.email || '', total_amount: total, status: 'draft' }).select().single();
    if (!ins.data) throw new Error(ins.error?.message || 'insert failed');
    await client.from('order_items').insert(items.map((i) => ({ ...i, order_id: ins.data.id })));
    return { draftOrderId: ins.data.id };
  }

  return { draftOrderId };
}

// ── Draft restore ───────────────────────────────────────────

/**
 * Restore draft for code-mode user.
 * @returns {{ draftOrderId, cartEntries: [{product_id, quantity, added_at, comment}] } | null}
 */
export async function restoreCodeDraft({ phone, codeSession, cachedDraftId }) {
  const client = sb;
  if (!client) return null;

  const clientId = codeSession?.id || null;
  const email = phone || codeSession?.email || '';

  const rpcFind = await client.rpc('get_code_draft', { p_user_email: email, p_client_id: clientId });
  let drafts = rpcFind.data || [];
  if (!drafts.length) return null;

  // Prefer cached draft ID
  let draftOrderId = null;
  if (cachedDraftId) {
    const match = drafts.find((d) => d.id === cachedDraftId);
    if (match) {
      draftOrderId = cachedDraftId;
      drafts = [match, ...drafts.filter((d) => d.id !== cachedDraftId)];
    }
  }
  if (!draftOrderId) draftOrderId = drafts[0].id;

  // Clean stale drafts
  if (drafts.length > 1) {
    for (let i = 1; i < drafts.length; i++) {
      await client.from('order_items').delete().eq('order_id', drafts[i].id);
      await client.from('orders').delete().eq('id', drafts[i].id).eq('status', 'draft');
    }
  }

  // Load items
  const ir = await client.rpc('get_code_draft_items', { p_order_id: draftOrderId });
  const items = ir.data || [];

  return {
    draftOrderId,
    cartEntries: items.map((it) => ({
      product_id: it.product_id,
      quantity: it.quantity,
      added_at: it.added_at || new Date().toISOString(),
      comment: it.comment || '',
    })),
  };
}

/**
 * Restore draft for email-authenticated user.
 */
export async function restoreEmailDraft({ userId }) {
  const client = sb;
  if (!client || !userId) return null;

  const res = await client.from('orders').select('id,total_amount,updated_at').eq('user_id', userId).eq('status', 'draft').order('updated_at', { ascending: false });
  const drafts = res.data || [];
  if (!drafts.length) return null;

  const draft = drafts[0];

  // Clean stale drafts
  if (drafts.length > 1) {
    for (const old of drafts.slice(1)) {
      await client.from('order_items').delete().eq('order_id', old.id);
      await client.from('orders').delete().eq('id', old.id).eq('status', 'draft');
    }
  }

  const res2 = await client.from('order_items').select('product_id,quantity,added_at,comment').eq('order_id', draft.id);
  const items = res2.data || [];

  return {
    draftOrderId: draft.id,
    cartEntries: items.map((it) => ({
      product_id: it.product_id,
      quantity: it.quantity,
      added_at: it.added_at || new Date().toISOString(),
      comment: it.comment || '',
    })),
  };
}

// ── Confirm order ───────────────────────────────────────────

/**
 * Save/confirm order to Supabase. Returns order ID.
 */
export async function confirmOrder({ cart, products, customerName, customerLocation, customerInfo, totalAmount, deliveryDate, codeSession, currentUser, draftOrderId }) {
  const client = sb;
  if (!client) return null;

  const items = buildOrderItems(cart, products);
  const isCode = !!codeSession;
  const userName = customerName || (isCode ? codeSession.name : '');
  const userAddr = customerLocation || (isCode ? codeSession.delivery_address : '');
  const userEmail = currentUser ? currentUser.email : (isCode ? codeSession.phone : '');

  let orderId;

  if (isCode && draftOrderId) {
    // Upgrade draft via RPC
    const rpc = await client.rpc('confirm_code_order', {
      p_order_id: draftOrderId,
      p_user_name: userName || '',
      p_user_location: userAddr || '',
      p_user_notes: customerInfo || '',
      p_total_amount: parseFloat(totalAmount) || 0,
      p_items: JSON.parse(JSON.stringify(items)),
      p_delivery_date: deliveryDate || null,
    });
    if (rpc.error) throw rpc.error;
    orderId = rpc.data || draftOrderId;
  } else if (isCode) {
    // New order via RPC
    const rpc = await client.rpc('insert_code_order', {
      p_user_email: userEmail || '',
      p_user_name: userName || '',
      p_user_location: userAddr || '',
      p_user_notes: customerInfo || '',
      p_total_amount: parseFloat(totalAmount) || 0,
      p_items: items,
    });
    if (rpc.error) throw rpc.error;
    orderId = rpc.data;
  } else if (draftOrderId) {
    // Upgrade email-user draft
    const upd = await client.from('orders').update({
      user_name: userName, user_location: userAddr, user_notes: customerInfo || '',
      total_amount: parseFloat(totalAmount) || 0, status: 'new', updated_at: new Date().toISOString(),
    }).eq('id', draftOrderId).eq('status', 'draft').select();

    if (!upd.data?.length) {
      // Draft gone — create fresh
      const ins = await client.from('orders').insert({
        user_id: currentUser.id, user_email: currentUser.email || '',
        user_name: userName, user_location: userAddr, user_notes: customerInfo || '',
        total_amount: parseFloat(totalAmount) || 0, status: 'new',
      }).select().single();
      if (ins.error) throw ins.error;
      orderId = ins.data.id;
      await client.from('order_items').insert(items.map((i) => ({ ...i, order_id: orderId })));
    } else {
      await client.from('order_items').delete().eq('order_id', draftOrderId);
      await client.from('order_items').insert(items.map((i) => ({ ...i, order_id: draftOrderId })));
      orderId = draftOrderId;
    }
  } else if (currentUser) {
    // Fresh order for email user
    const ins = await client.from('orders').insert({
      user_id: currentUser.id, user_email: currentUser.email || '',
      user_name: userName, user_location: userAddr, user_notes: customerInfo || '',
      total_amount: parseFloat(totalAmount) || 0, status: 'new',
    }).select().single();
    if (ins.error) throw ins.error;
    orderId = ins.data.id;
    await client.from('order_items').insert(items.map((i) => ({ ...i, order_id: orderId })));
  }

  return orderId;
}

// ── Fetch client orders (profile) ───────────────────────────

export async function getClientOrders(clientId) {
  const { data, error } = await sb.rpc('get_client_orders', { p_client_id: clientId });
  if (error) throw error;
  return data; // { orders: [...], items: [...] }
}
