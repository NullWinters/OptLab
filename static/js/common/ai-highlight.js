/**
 * AIHighlight - 模块化页面高亮引导系统
 *
 * 职责：
 * 1. 按给定 ID 序列依次高亮页面控件。
 * 2. 自动跳过当前不可见的控件（display:none / visibility:hidden / hidden 属性 / 祖先隐藏 / 尺寸为 0）。
 * 3. 支持“点击控件后下一步”和“可选自动推进”两种模式。
 * 4. 提供统一的遮罩定位、滚动跟随和清理能力。
 */
(function (global) {
    'use strict';

    function AIHighlight(options) {
        options = options || {};

        this.overlay = null;
        if (options.overlay) {
            this.overlay = typeof options.overlay === 'string'
                ? document.getElementById(options.overlay)
                : options.overlay;
        }
        if (!this.overlay) {
            this.overlay = document.getElementById('ai-highlight-overlay');
        }

        this.optionalAdvanceMs = options.optionalAdvanceMs || 2600;
        this.isOptional = typeof options.isOptional === 'function' ? options.isOptional : function () { return false; };
        this.onStep = typeof options.onStep === 'function' ? options.onStep : null;
        this.onFinish = typeof options.onFinish === 'function' ? options.onFinish : null;
        this.onClear = typeof options.onClear === 'function' ? options.onClear : null;

        this.ids = [];
        this.index = -1;
        this._optionalTimer = null;
        this._renderToken = 0;
    }

    /**
     * 判断元素当前是否对用户可见。
     * 判定为不可见的情况：
     * - 元素不存在
     * - 带 hidden 属性
     * - 自身或任意祖先 display:none / visibility:hidden / opacity<=0
     * - 元素在视口中的宽高为 0
     */
    AIHighlight.isElementVisible = function (el) {
        if (!el || !(el instanceof Element)) return false;
        if (el.hasAttribute('hidden')) return false;

        function isInvisibleStyle(style) {
            if (!style) return false;
            if (style.display === 'none') return true;
            if (style.visibility === 'hidden') return true;
            var opacity = parseFloat(style.opacity);
            if (!isNaN(opacity) && opacity <= 0) return true;
            return false;
        }

        var selfStyle = window.getComputedStyle(el);
        if (isInvisibleStyle(selfStyle)) return false;

        var parent = el.parentElement;
        while (parent && parent !== document.body) {
            if (parent.hasAttribute('hidden')) return false;
            var pStyle = window.getComputedStyle(parent);
            if (isInvisibleStyle(pStyle)) return false;
            parent = parent.parentElement;
        }

        var rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;

        return true;
    };

    AIHighlight.prototype.isElementVisible = function (el) {
        return AIHighlight.isElementVisible(el);
    };

    AIHighlight.prototype.setSequence = function (ids) {
        this.clear();
        this.ids = Array.isArray(ids) ? ids.slice() : [];
        this.index = -1;
    };

    AIHighlight.prototype.start = function () {
        if (!this.ids.length) {
            this._finish();
            return;
        }
        this.index = 0;
        this._show();
    };

    AIHighlight.prototype.next = function () {
        this._clearOptionalTimer();
        this._unbindCurrent();
        this.index++;
        this._show();
    };

    AIHighlight.prototype.clear = function () {
        this._clearOptionalTimer();
        this._unbindAll();
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
        this.ids = [];
        this.index = -1;
        this._renderToken++;
        if (this.onClear) {
            this.onClear();
        }
    };

    AIHighlight.prototype.currentId = function () {
        if (this.index >= 0 && this.index < this.ids.length) {
            return this.ids[this.index];
        }
        return null;
    };

    AIHighlight.prototype.reposition = function () {
        var id = this.currentId();
        if (!id || !this.overlay) return;
        var el = document.getElementById(id);
        if (!el || !this.isElementVisible(el)) return;

        var rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.right >= 0) {
            this._positionOverlay(el);
        }
    };

    AIHighlight.prototype._show = function () {
        this._clearOptionalTimer();
        this._unbindCurrent();

        while (this.index >= 0 && this.index < this.ids.length) {
            var id = this.ids[this.index];
            var el = document.getElementById(id);
            if (!el || !this.isElementVisible(el)) {
                this.index++;
                continue;
            }

            this._render(el, id);
            return;
        }

        this._finish();
    };

    AIHighlight.prototype._render = function (el, id) {
        var self = this;
        var token = ++this._renderToken;
        var stepNo = this.index + 1;

        if (this.onStep) {
            this.onStep(id, stepNo);
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(function () {
            if (self._renderToken !== token) return;
            self._positionOverlay(el);
            if (self.overlay) {
                self.overlay.style.display = 'block';
            }
        }, 350);

        if (this._shouldAutoAdvance(el, id)) {
            this._startOptionalTimer();
        } else {
            this._bindClick(el);
        }
    };

    AIHighlight.prototype._shouldAutoAdvance = function (el, id) {
        if (this.isOptional(id)) return true;
        var isSvg = (typeof SVGElement !== 'undefined' && el instanceof SVGElement) ||
            el.ownerSVGElement ||
            el.tagName.toLowerCase() === 'svg';
        return isSvg;
    };

    AIHighlight.prototype._bindClick = function (el) {
        var self = this;
        var handler = function () {
            self.next();
        };
        el._aiClickHandler = handler;
        el.addEventListener('click', handler, { once: true });
    };

    AIHighlight.prototype._unbindCurrent = function () {
        var id = this.currentId();
        if (!id) return;
        var el = document.getElementById(id);
        this._unbindElement(el);
    };

    AIHighlight.prototype._unbindAll = function () {
        for (var i = 0; i < this.ids.length; i++) {
            var el = document.getElementById(this.ids[i]);
            this._unbindElement(el);
        }
    };

    AIHighlight.prototype._unbindElement = function (el) {
        if (el && el._aiClickHandler) {
            el.removeEventListener('click', el._aiClickHandler);
            delete el._aiClickHandler;
        }
    };

    AIHighlight.prototype._startOptionalTimer = function () {
        var self = this;
        this._clearOptionalTimer();
        this._optionalTimer = setTimeout(function () {
            self.next();
        }, this.optionalAdvanceMs);
    };

    AIHighlight.prototype._clearOptionalTimer = function () {
        if (this._optionalTimer) {
            clearTimeout(this._optionalTimer);
            this._optionalTimer = null;
        }
    };

    AIHighlight.prototype._positionOverlay = function (el) {
        if (!this.overlay) return;
        var rect = el.getBoundingClientRect();
        var pad = 4;
        this.overlay.style.left = (rect.left - pad) + 'px';
        this.overlay.style.top = (rect.top - pad) + 'px';
        this.overlay.style.width = (rect.width + pad * 2) + 'px';
        this.overlay.style.height = (rect.height + pad * 2) + 'px';
    };

    AIHighlight.prototype._finish = function () {
        this._clearOptionalTimer();
        this._unbindCurrent();
        if (this.overlay) {
            this.overlay.style.display = 'none';
        }
        this.index = -1;
        if (this.onFinish) {
            this.onFinish();
        }
    };

    global.AIHighlight = AIHighlight;
})(window);
