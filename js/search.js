// js/search.js
(() => {
  'use strict'

  const MIN_CHARS = 2
  const DEBOUNCE_MS = 250

  let debounceTimer = null
  let lastQuery = ''
  let lastSuggestions = []

  function qs (sel) {
    return document.querySelector(sel)
  }

  function setHidden (el, hidden) {
    if (!el) return
    el.classList.toggle('d-none', Boolean(hidden))
  }

  function escapeHtml (str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function getLastWord (text) {
    const trimmed = String(text || '')
    const match = trimmed.match(/(\S+)\s*$/)
    return match ? match[1] : ''
  }

  function replaceLastWord (text, replacement) {
    const s = String(text || '')
    if (!s.trim()) return replacement
    const idx = s.search(/\S+\s*$/)
    if (idx === -1) return replacement
    const prefix = s.slice(0, idx)
    return prefix + replacement
  }

  function closeList () {
    const list = qs('#autocompleteList')
    if (!list) return
    list.innerHTML = ''
    setHidden(list, true)
  }

  function renderList (items) {
    const list = qs('#autocompleteList')
    if (!list) return

    if (!items || items.length === 0) {
      closeList()
      return
    }

    list.innerHTML = items
      .slice(0, 8)
      .map((t) => {
        const safe = escapeHtml(t)
        return `<button type="button" class="list-group-item list-group-item-action" data-text="${safe}">${safe}</button>`
      })
      .join('')

    setHidden(list, false)
  }

  async function loadSuggestions (inputValue) {
    const input = qs('#searchInput')
    if (!input) return

    const lastWord = getLastWord(inputValue)
    if (lastWord.length < MIN_CHARS) {
      closeList()
      return
    }

    const query = lastWord.trim()
    lastQuery = query

    try {
      const items = await window.WebExamApi.getAutocomplete(query)

      if (lastQuery !== query) return

      lastSuggestions = Array.isArray(items) ? items : []
      renderList(lastSuggestions)
    } catch (e) {
      closeList()
    }
  }

  function onInput () {
    const input = qs('#searchInput')
    if (!input) return

    const value = input.value

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      loadSuggestions(value)
    }, DEBOUNCE_MS)
  }

  function onClickSuggestion (e) {
    const btn = e.target.closest('[data-text]')
    if (!btn) return

    const input = qs('#searchInput')
    if (!input) return

    const text = btn.getAttribute('data-text') || ''
    const updated = replaceLastWord(input.value, text)

    input.value = updated
    closeList()
    input.focus()
  }

  function onDocumentClick (e) {
    const box = qs('#searchBox')
    if (!box) return
    if (!box.contains(e.target)) closeList()
  }

  function onKeyDown (e) {
    if (e.key === 'Escape') closeList()
  }

  function emitSearch () {
    const input = qs('#searchInput')
    if (!input) return
    const query = String(input.value || '').trim()
    window.dispatchEvent(new CustomEvent('webexam:search', { detail: { query } }))
    closeList()
  }

  function bind () {
    const input = qs('#searchInput')
    const btn = qs('#searchButton')
    const list = qs('#autocompleteList')

    if (!input || !btn || !list) return

    input.addEventListener('input', onInput)
    input.addEventListener('keydown', onKeyDown)

    btn.addEventListener('click', emitSearch)

    list.addEventListener('click', onClickSuggestion)
    document.addEventListener('click', onDocumentClick)

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        emitSearch()
      }
    })
  }

  document.addEventListener('DOMContentLoaded', bind)
})()
