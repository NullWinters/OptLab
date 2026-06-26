/**
 * OptLab 首页实验卡片轮播组件 - 单卡片飞入飞出轮播
 * 特性：每次只显示一张卡片，点击切换时当前卡片平移飞出边界，新卡片从相反位置飞入
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        initCarousel();
    });

    function initCarousel() {
        const container = document.querySelector('.carousel-container');
        if (!container) return;

        const viewport = container.querySelector('.carousel-viewport');
        const prevBtn = container.querySelector('.carousel-prev');
        const nextBtn = container.querySelector('.carousel-next');
        const dots = container.querySelectorAll('.carousel-dots .dot');
        const dataContainer = document.querySelector('.carousel-data');

        if (!viewport || !dataContainer) return;

        const experiments = Array.from(dataContainer.querySelectorAll('.experiment-item'));
        const totalSlides = experiments.length;

        if (totalSlides === 0) return;

        // 状态管理
        let currentIndex = 0;
        let isAnimating = false;
        let autoPlayTimer = null;
        let pauseTimer = null;
        const AUTO_PLAY_INTERVAL = 2000;
        const PAUSE_DURATION = 10000;

        // 初始化
        renderCurrentCard();
        updateDots();
        startAutoPlay();

        // 事件绑定
        prevBtn.addEventListener('click', function () {
            navigate('prev');
        });
        nextBtn.addEventListener('click', function () {
            navigate('next');
        });

        // 点击指示器
        dots.forEach(function (dot, index) {
            dot.addEventListener('click', function () {
                if (isAnimating || index === currentIndex) return;
                const direction = index > currentIndex ? 'next' : 'prev';
                navigateTo(index, direction);
            });
        });

        // 触摸滑动支持
        let touchStartX = 0;
        container.addEventListener('touchstart', function (e) {
            touchStartX = e.changedTouches[0].screenX;
        }, {passive: true});

        container.addEventListener('touchend', function (e) {
            const diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) {
                navigate(diff > 0 ? 'next' : 'prev');
            }
        }, {passive: true});

        // 导航到上一张或下一张
        function navigate(direction) {
            if (isAnimating) return;

            let newIndex;
            if (direction === 'next') {
                newIndex = (currentIndex + 1) % totalSlides;
            } else {
                newIndex = (currentIndex - 1 + totalSlides) % totalSlides;
            }

            navigateTo(newIndex, direction);
        }

        // 核心：飞入飞出切换动画
        function navigateTo(newIndex, direction) {
            if (isAnimating) return;
            isAnimating = true;
            currentIndex = newIndex;

            // 确定飞出/飞入方向
            const isNext = direction === 'next';

            // 获取当前卡片
            const currentCard = viewport.querySelector('.carousel-card');
            if (!currentCard) {
                isAnimating = false;
                return;
            }

            // 创建新卡片
            const newCard = document.createElement('div');
            newCard.className = 'carousel-card';
            newCard.innerHTML = experiments[currentIndex].innerHTML;

            // 新卡片初始位置：在屏幕外
            if (isNext) {
                // 从右侧进入
                newCard.style.transform = 'translateX(50vw)';
                newCard.style.opacity = '0';
            } else {
                // 从左侧进入
                newCard.style.transform = 'translateX(-150vw)';
                newCard.style.opacity = '0';
            }

            viewport.appendChild(newCard);

            // 触发同时动画
            requestAnimationFrame(function () {
                // 当前卡片添加飞出动画
                if (isNext) {
                    // 点击下一个：当前卡片向左飞出
                    currentCard.classList.add('slide-out-left');
                } else {
                    // 点击上一个：当前卡片向右飞出
                    currentCard.classList.add('slide-out-right');
                }

                // 新卡片添加飞入动画
                if (isNext) {
                    newCard.classList.add('slide-in-right');
                } else {
                    newCard.classList.add('slide-in-left');
                }
            });

            // 动画结束后清理
            setTimeout(function () {
                // 移除旧卡片
                if (currentCard && currentCard.parentNode) {
                    currentCard.remove();
                }

                // 新卡片重置为正常状态
                newCard.className = 'carousel-card current';
                newCard.style.cssText = '';

                isAnimating = false;
            }, 500);

            // 更新指示器
            updateDots();

            // 暂停自动播放
            pauseAutoPlay();
        }

        // 渲染当前卡片（初始化时使用）
        function renderCurrentCard() {
            const card = document.createElement('div');
            card.className = 'carousel-card current';
            card.innerHTML = experiments[currentIndex].innerHTML;
            viewport.innerHTML = '';
            viewport.appendChild(card);
        }

        // 更新指示器状态
        function updateDots() {
            dots.forEach(function (dot, index) {
                dot.classList.toggle('active', index === currentIndex);
            });
        }

        // 自动播放控制
        function startAutoPlay() {
            if (autoPlayTimer) clearInterval(autoPlayTimer);
            autoPlayTimer = setInterval(function () {
                if (!isAnimating) navigate('next');
            }, AUTO_PLAY_INTERVAL);
        }

        function stopAutoPlay() {
            if (autoPlayTimer) {
                clearInterval(autoPlayTimer);
                autoPlayTimer = null;
            }
        }

        function pauseAutoPlay() {
            stopAutoPlay();
            if (pauseTimer) clearTimeout(pauseTimer);
            pauseTimer = setTimeout(startAutoPlay, PAUSE_DURATION);
        }

        // 页面不可见时暂停自动播放
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                stopAutoPlay();
            } else {
                startAutoPlay();
            }
        });
    }
})();
