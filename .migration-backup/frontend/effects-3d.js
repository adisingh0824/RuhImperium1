(function () {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;

    function bindCardTilt(card) {
        if (prefersReduced || isCoarse) return;
        card.addEventListener('mousemove', event => {
            const rect = card.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            card.style.setProperty('--tilt-x', `${(-y * 10).toFixed(2)}deg`);
            card.style.setProperty('--tilt-y', `${(x * 12).toFixed(2)}deg`);
            card.classList.add('is-tilted');
        });
        card.addEventListener('mouseleave', () => {
            card.classList.remove('is-tilted');
            card.style.removeProperty('--tilt-x');
            card.style.removeProperty('--tilt-y');
        });
    }

    function bindHeroParallax() {
        const hero = document.querySelector('.hero');
        if (!hero || prefersReduced) return;
        const layers = hero.querySelectorAll('[data-depth]');
        if (!layers.length) return;
        hero.addEventListener('mousemove', event => {
            const rect = hero.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;
            layers.forEach(layer => {
                const depth = Number(layer.dataset.depth) || 1;
                layer.style.transform = `translate3d(${x * depth * 14}px, ${y * depth * 10}px, ${depth * 24}px)`;
            });
        });
        hero.addEventListener('mouseleave', () => {
            layers.forEach(layer => { layer.style.transform = ''; });
        });
    }

    function bindAnnouncementPause() {
        const bar = document.querySelector('.sliding-banner');
        if (!bar) return;
        const pause = () => bar.classList.add('paused');
        const resume = () => bar.classList.remove('paused');
        bar.addEventListener('mouseenter', pause);
        bar.addEventListener('mouseleave', resume);
        bar.addEventListener('touchstart', pause, { passive: true });
        bar.addEventListener('touchend', () => setTimeout(resume, 4000), { passive: true });
    }

    window.initRuh3D = function initRuh3D() {
        document.querySelectorAll('.scene-3d').forEach(scene => {
            if (!scene.dataset.tiltBound) {
                scene.dataset.tiltBound = '1';
            }
        });
        document.querySelectorAll('.card-3d').forEach(bindCardTilt);
        bindHeroParallax();
        bindAnnouncementPause();
    };

    window.refreshRuh3D = function refreshRuh3D(root = document) {
        root.querySelectorAll('.card-3d').forEach(card => {
            if (card.dataset.tiltReady) return;
            card.dataset.tiltReady = '1';
            bindCardTilt(card);
        });
    };
})();
