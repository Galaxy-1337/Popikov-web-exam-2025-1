(() => {
  'use strict'

  function qs (sel) {
    return document.querySelector(sel)
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

  function readForm () {
    const form = qs('#orderForm')
    if (!form) return null

    const data = {
      full_name: qs('#fullName')?.value?.trim() || '',
      email: qs('#email')?.value?.trim() || '',
      phone: qs('#phone')?.value?.trim() || '',
      subscribe: qs('#subscribe')?.checked ? 1 : 0,
      delivery_address: qs('#address')?.value?.trim() || '',
      delivery_date: qs('#deliveryDate')?.value || '',
      delivery_interval: qs('#deliveryInterval')?.value || '',
      comment: qs('#comment')?.value?.trim() || ''
    }
    
    return data
  }

  function validate (data, cartIds) {
    if (!data) return 'Форма не найдена.'
    
    if (!data.full_name || data.full_name.trim() === '') {
      return 'Введите имя.'
    }
    
    if (!data.email || data.email.trim() === '') {
      return 'Введите email.'
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      return 'Введите корректный email адрес.'
    }
    
    if (!data.phone || data.phone.trim() === '') {
      return 'Введите телефон.'
    }
    
    if (!data.delivery_address || data.delivery_address.trim() === '') {
      return 'Введите адрес доставки.'
    }
    
    if (!data.delivery_date || data.delivery_date.trim() === '') {
      return 'Выберите дату доставки.'
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(data.delivery_date)) {
      return 'Неверный формат даты доставки.'
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const deliveryDate = new Date(data.delivery_date)
    
    if (deliveryDate < today) {
      return 'Дата доставки не может быть в прошлом.'
    }
    
    if (!data.delivery_interval || data.delivery_interval.trim() === '') {
      return 'Выберите интервал доставки.'
    }
    
    if (!cartIds || cartIds.length === 0) {
      return 'Корзина пуста.'
    }
    
    return ''
  }

  function buildPayload (data, cartIds) {
    if (!data) throw new Error('Данные формы отсутствуют')
    
    const goodIds = cartIds.map(id => Number(id)).filter(id => Number.isFinite(id))
    
    function formatDate(dateStr) {
      if (!dateStr) return ''
      const parts = dateStr.split('-')
      if (parts.length !== 3) return dateStr
      return `${parts[2]}.${parts[1]}.${parts[0]}`
    }
    
    const payload = {
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      subscribe: data.subscribe,
      delivery_address: data.delivery_address,
      delivery_date: formatDate(data.delivery_date),
      delivery_interval: data.delivery_interval,
      good_ids: goodIds
    }
    
    if (data.comment && data.comment.trim() !== '') {
      payload.comment = data.comment.trim()
    }
    
    return payload
  }

  async function submitOrder () {
    const cartIds = window.WebExamStorage.readCartIds()
    const data = readForm()

    const err = validate(data, cartIds)
    if (err) {
      notify('danger', err)
      return
    }

    const payload = buildPayload(data, cartIds)

    try {
      const submitBtn = qs('#submitOrderBtn')
      if (submitBtn) {
        submitBtn.disabled = true
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Отправка...'
      }
      
      await window.WebExamApi.createOrder(payload)
      
      window.WebExamStorage.clearCart()
      notify('success', 'Заказ успешно оформлен!')
      
      setTimeout(() => {
        window.location.href = 'profile.html'
      }, 1500)
      
    } catch (e) {
      let errorMessage = 'Ошибка при оформлении заказа'
      if (e && e.message) {
        errorMessage = e.message
      }
      
      if (e && e.data) {
        if (e.data.error) {
          errorMessage = e.data.error
        } else if (e.data.message) {
          errorMessage = e.data.message
        }
      }
      
      notify('danger', errorMessage)
      
      const submitBtn = qs('#submitOrderBtn')
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.textContent = 'Оформить'
      }
    }
  }

  function bind () {
    const form = qs('#orderForm')
    if (!form) return

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      submitOrder()
    })
    
    const deliveryDateInput = qs('#deliveryDate')
    if (deliveryDateInput) {
      const today = new Date().toISOString().split('T')[0]
      deliveryDateInput.setAttribute('min', today)
    }
  }

  document.addEventListener('DOMContentLoaded', bind);
})()
