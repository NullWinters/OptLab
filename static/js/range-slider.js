/* 设置 --range-percent；无 .range-slider-wrap 时自动包一层 */
function initRangeSliders() {
  document.querySelectorAll('input[type="range"]').forEach(function (el) {
    if (el.dataset.rangeSliderInit === '1') return;
    el.dataset.rangeSliderInit = '1';

    var wrapper = el.closest('.range-slider-wrap');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'range-slider-wrap';
      el.parentNode.insertBefore(wrapper, el);
      wrapper.appendChild(el);
    }

    function update() {
      var min = parseFloat(el.getAttribute('min'));
      if (isNaN(min)) min = 0;
      var max = parseFloat(el.getAttribute('max'));
      if (isNaN(max)) max = 100;

      var rawVal = parseFloat(el.value);
      var val = isNaN(rawVal) ? min : rawVal;

      var pct = max === min ? 0 : ((val - min) / (max - min)) * 100;
      var value = pct + '%';
      wrapper.style.setProperty('--range-percent', value);
      el.style.setProperty('--range-percent', value);
    }

    el.addEventListener('input', update);
    el.addEventListener('change', update);
    update();
  });
}

window.initRangeSliders = initRangeSliders;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    initRangeSliders();
    setTimeout(initRangeSliders, 150);
  });
} else {
  initRangeSliders();
  setTimeout(initRangeSliders, 150);
}
