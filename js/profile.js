(() => {
  'use strict'

  function qs (sel) {
    return document.querySelector(sel)
  }

  function qsa (sel) {
    return Array.from(document.querySelectorAll(sel))
  }

  function setHidden (el, hidden) {
    if (!el) return
    el.classList.toggle('d-none', Boolean(hidden))
  }

  function showLoading (show) {
    setHidden(qs('#loadingIndicator'), !show)
  }

  function notify (type, text) {
    const box = qs('#notifications')
    if (!box) return

    const cls =
      type === 'success' ? 'alert-success' :
      type === 'danger' ? 'alert-danger' :
      'alert-primary'

    const el = document.createElement('div')
    el.className = `alert ${cls} d-flex align-items-center justify-content-between mb-0`
    el.setAttribute('role', 'alert')
    el.innerHTML = `
      <div>${text}</div>
      <button type="button" class="btn btn-sm btn-outline-secondary">Ок</button>
    `

    el.querySelector('button').addEventListener('click', () => el.remove())
    box.prepend(el)

    setTimeout(() => {
      if (el.isConnected) el.remove()
    }, 5000)
  }

  function formatDate (iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d)) return '—'
    return d.toLocaleDateString('ru-RU')
  }

  function formatPrice (v) {
    return window.WebExamStorage.formatPrice(v)
  }

  function updateCartBadge () {
    const badge = qs('#cartCountBadge')
    if (!badge) return
    badge.textContent = window.WebExamStorage.getCartCount()
  }

  function renderEmpty () {
    setHidden(qs('#emptyState'), false)
    qs('#ordersTbody').innerHTML = ''
  }

  // Загрузка товаров по ID
  async function loadGoodsByIds (goodIds) {
    if (!goodIds || !Array.isArray(goodIds) || goodIds.length === 0) {
      return []
    }

    const tasks = goodIds.map(async (id) => {
      try {
        return await window.WebExamApi.getGoodById(id)
      } catch (e) {
        return null
      }
    })

    const goods = await Promise.all(tasks)
    return goods.filter(Boolean)
  }

  function pickPrice (good) {
    const ap = Number(good?.actual_price)
    const dp = Number(good?.discount_price)
    if (Number.isFinite(dp) && dp > 0 && Number.isFinite(ap) && dp < ap) return dp
    if (Number.isFinite(dp) && dp > 0 && !Number.isFinite(ap)) return dp
    return Number.isFinite(ap) ? ap : 0
  }

  // Обогащение заказа товарами по good_ids
  async function enrichOrderWithGoods (order) {
    if (order.good_ids && Array.isArray(order.good_ids) && order.good_ids.length > 0) {
      const goods = await loadGoodsByIds(order.good_ids)
      order.goods = goods
      order.total_sum = goods.reduce((sum, g) => sum + pickPrice(g), 0)
    } else {
      order.goods = []
      order.total_sum = 0
    }

    return order
  }

  function renderTable (orders) {
    const tbody = qs('#ordersTbody')
    if (!tbody) return

    if (!orders || orders.length === 0) {
      renderEmpty()
      return
    }

    setHidden(qs('#emptyState'), true)

    tbody.innerHTML = orders.map(o => `
      <tr data-id="${o.id}">
        <td>${o.id}</td>
        <td>${formatDate(o.created_at)}</td>
        <td>${(o.goods || []).length}</td>
        <td>${formatPrice(o.total_sum)}</td>
        <td>${formatDate(o.delivery_date)} ${o.delivery_interval || ''}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" data-action="details">Подробнее</button>
            <button class="btn btn-outline-secondary" data-action="edit">Изменить</button>
            <button class="btn btn-outline-danger" data-action="delete">Удалить</button>
          </div>
        </td>
      </tr>
    `).join('')
  }

  async function loadOrders () {
    showLoading(true)
    try {
      const orders = await window.WebExamApi.getOrders()
      const ordersArray = Array.isArray(orders) ? orders : []
      
      const enrichedOrders = await Promise.all(
        ordersArray.map(order => enrichOrderWithGoods(order))
      )
      
      renderTable(enrichedOrders)
    } catch (e) {
      notify('danger', 'Не удалось загрузить заказы.')
      renderEmpty()
    } finally {
      showLoading(false)
    }
  }

  async function openDetails (id) {
    try {
      const o = await window.WebExamApi.getOrderById(id)
      
      // Обогащаем заказ товарами, если их нет
      const enrichedOrder = await enrichOrderWithGoods(o)

      qs('#d_id').textContent = enrichedOrder.id
      qs('#d_date').textContent = formatDate(enrichedOrder.created_at)
      qs('#d_name').textContent = enrichedOrder.full_name
      qs('#d_email').textContent = enrichedOrder.email
      qs('#d_phone').textContent = enrichedOrder.phone
      qs('#d_address').textContent = enrichedOrder.delivery_address
      qs('#d_delivery').textContent =
        `${formatDate(enrichedOrder.delivery_date)} ${enrichedOrder.delivery_interval || ''}`
      qs('#d_total').textContent = formatPrice(enrichedOrder.total_sum)
      qs('#d_comment').textContent = enrichedOrder.comment || '—'

      const goodsBox = qs('#d_goods')
      if (goodsBox) {
        const goods = enrichedOrder.goods || []
        goodsBox.innerHTML = goods.length > 0
          ? goods.map(g => `<div>#${g.id} — ${g.name || g.title || 'Без названия'}</div>`).join('')
          : '<div>Товары не найдены</div>'
      }

      new bootstrap.Modal(qs('#detailsModal')).show()
    } catch (e) {
      notify('danger', 'Не удалось загрузить заказ.')
    }
  }

  async function openEdit (id) {
    try {
      const o = await window.WebExamApi.getOrderById(id)

      qs('#e_id').value = o.id
      qs('#e_full_name').value = o.full_name
      qs('#e_email').value = o.email
      qs('#e_phone').value = o.phone
      qs('#e_address').value = o.delivery_address
      qs('#e_delivery_date').value = o.delivery_date
      qs('#e_delivery_interval').value = o.delivery_interval
      qs('#e_subscribe').checked = Boolean(o.subscribe)
      qs('#e_comment').value = o.comment || ''

      new bootstrap.Modal(qs('#editModal')).show()
    } catch (e) {
      notify('danger', 'Не удалось открыть заказ.')
    }
  }

  async function saveEdit () {
    const id = qs('#e_id').value
    if (!id) return

    const payload = {
      full_name: qs('#e_full_name').value.trim(),
      email: qs('#e_email').value.trim(),
      phone: qs('#e_phone').value.trim(),
      delivery_address: qs('#e_address').value.trim(),
      delivery_date: qs('#e_delivery_date').value,
      delivery_interval: qs('#e_delivery_interval').value,
      subscribe: qs('#e_subscribe').checked ? 1 : 0,
      comment: qs('#e_comment').value.trim()
    }

    try {
      await window.WebExamApi.updateOrder(id, payload)
      bootstrap.Modal.getInstance(qs('#editModal')).hide()
      notify('success', 'Заказ обновлён.')
      loadOrders()
    } catch (e) {
      notify('danger', 'Не удалось сохранить изменения.')
    }
  }

  function openDelete (id) {
    qs('#del_id').value = id
    qs('#del_label').textContent = `#${id}`
    new bootstrap.Modal(qs('#deleteModal')).show()
  }

  async function confirmDelete () {
    const id = qs('#del_id').value
    if (!id) return

    try {
      await window.WebExamApi.deleteOrder(id)
      bootstrap.Modal.getInstance(qs('#deleteModal')).hide()
      notify('success', 'Заказ удалён.')
      loadOrders()
    } catch (e) {
      notify('danger', 'Не удалось удалить заказ.')
    }
  }

  function bindTableActions () {
    qs('#ordersTbody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return

      const tr = btn.closest('tr')
      if (!tr) return

      const id = tr.getAttribute('data-id')
      if (!id) return

      const action = btn.getAttribute('data-action')

      if (action === 'details') openDetails(id)
      if (action === 'edit') openEdit(id)
      if (action === 'delete') openDelete(id)
    })
  }

  function bind () {
    updateCartBadge()
    bindTableActions()

    qs('#refreshBtn')?.addEventListener('click', loadOrders)
    qs('#saveEditBtn')?.addEventListener('click', saveEdit)
    qs('#confirmDeleteBtn')?.addEventListener('click', confirmDelete)

    loadOrders()
  }

  document.addEventListener('DOMContentLoaded', bind)
})()
