/* Мелочи портальной оболочки. Ничего критичного: без этого файла страницы
   работают полностью, подпись просто остаётся в варианте для Windows/Linux. */

(() => {
  // ⌘ — клавиша Command, её нет на Windows и Linux. Подставляем подпись
  // по системе: на маке ⌘K, везде иначе Ctrl K.
  const mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');
  for (const el of document.querySelectorAll('[data-shortcut]')) {
    el.textContent = mac ? '⌘K' : 'Ctrl K';
  }
})();
