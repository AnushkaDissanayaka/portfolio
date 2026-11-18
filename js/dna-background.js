/*==============================================================
                    ANIMATED DNA BACKGROUND
    Rotating double-helix fragments, drifting nucleotides and
    particles drawn on a fixed canvas behind the page content.
==============================================================*/

(function () {

    const canvas = document.createElement('canvas');
    canvas.id = 'dna-bg';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');

    const reduceMotion =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Base-pair colours: A–T and G–C, kept within the site's cyan palette
    const BASE_COLORS = {
        A: '0,229,255',
        T: '45,212,191',
        G: '129,140,248',
        C: '96,165,250'
    };
    const PAIRS = [['A', 'T'], ['T', 'A'], ['G', 'C'], ['C', 'G']];
    const LETTERS = ['A', 'T', 'G', 'C'];

    let W = 0;
    let H = 0;
    let dpr = 1;
    let helices = [];
    let particles = [];
    let pointerX = 0;
    let pointerY = 0;
    let scrollY = window.scrollY;
    let running = true;
    let lastTime = performance.now();

    const rand = (min, max) => min + Math.random() * (max - min);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    /*---------------------- helix fragments ----------------------*/

    function createHelix(spreadY) {

        // z: 0.35 (far, faint, slow) … 1 (near, bright, faster parallax)
        const z = rand(0.35, 1);
        const pairs = Math.round(rand(14, 26));

        return {
            x: rand(0, W),
            y: spreadY ? rand(0, H) : rand(-100, H + 100),
            z,
            pairs,
            spacing: 16 * z + 6,
            amp: 26 * z + 8,
            twist: rand(0.42, 0.6),
            angle: rand(-0.9, 0.9) + (Math.random() < 0.5 ? 0 : Math.PI / 2),
            phase: rand(0, Math.PI * 2),
            spin: rand(0.35, 0.7) * (Math.random() < 0.5 ? -1 : 1),
            vx: rand(-6, 6),
            vy: rand(-10, -3),
            sequence: Array.from({ length: pairs }, () => pick(PAIRS))
        };

    }

    function drawHelix(h) {

        const length = (h.pairs - 1) * h.spacing;
        const margin = length / 2 + 60;

        // Parallax: near fragments move more with scroll and pointer
        const px = h.x + pointerX * 18 * h.z;
        let py = h.y - scrollY * 0.18 * h.z + pointerY * 12 * h.z;

        // Wrap vertically so fragments loop through the viewport
        const span = H + margin * 2;
        py = ((py + margin) % span + span) % span - margin;

        if (px < -margin || px > W + margin) return;

        const cos = Math.cos(h.angle);
        const sin = Math.sin(h.angle);
        const toScreen = (along, offset) => [
            px + along * cos - offset * sin,
            py + along * sin + offset * cos
        ];

        const baseAlpha = 0.14 + h.z * 0.34;

        // Base-pair rungs, each half coloured by its nucleotide
        for (let i = 0; i < h.pairs; i++) {

            const t = i / (h.pairs - 1);
            const fade = Math.pow(Math.sin(Math.PI * t), 0.8);
            const theta = h.phase + i * h.twist;
            const offset = Math.sin(theta) * h.amp;
            const depth = Math.cos(theta);
            const along = (t - 0.5) * length;

            const [x1, y1] = toScreen(along, offset);
            const [x2, y2] = toScreen(along, -offset);
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;

            // Rungs seen edge-on (depth near ±1) are short and faint
            const rungAlpha = baseAlpha * fade * (0.35 + 0.4 * Math.abs(Math.sin(theta)));
            const [b1, b2] = h.sequence[i];

            ctx.lineWidth = 1.6 * h.z + 0.4;

            ctx.strokeStyle = `rgba(${BASE_COLORS[b1]},${rungAlpha})`;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(mx, my);
            ctx.stroke();

            ctx.strokeStyle = `rgba(${BASE_COLORS[b2]},${rungAlpha})`;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Backbone nodes: larger and brighter when facing the viewer
            const strands = [[x1, y1, depth], [x2, y2, -depth]];

            for (const [sx, sy, d] of strands) {

                const front = (d + 1) / 2;
                const r = (1.2 + front * 2.4) * (0.5 + h.z * 0.7);
                const a = baseAlpha * fade * (0.35 + front * 0.65);

                ctx.fillStyle = `rgba(0,229,255,${a})`;
                ctx.beginPath();
                ctx.arc(sx, sy, r, 0, Math.PI * 2);
                ctx.fill();

            }

        }

        // Sugar-phosphate backbones as smooth curves
        const steps = (h.pairs - 1) * 4;

        for (const sign of [1, -1]) {

            ctx.beginPath();

            for (let s = 0; s <= steps; s++) {

                const t = s / steps;
                const theta = h.phase + t * (h.pairs - 1) * h.twist;
                const offset = sign * Math.sin(theta) * h.amp;
                const [x, y] = toScreen((t - 0.5) * length, offset);

                if (s === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);

            }

            const gradient = ctx.createLinearGradient(
                ...toScreen(-length / 2, 0),
                ...toScreen(length / 2, 0)
            );
            const a = baseAlpha * 0.75;
            gradient.addColorStop(0, 'rgba(0,229,255,0)');
            gradient.addColorStop(0.5, `rgba(0,229,255,${a})`);
            gradient.addColorStop(1, 'rgba(0,229,255,0)');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 1.2 * h.z + 0.5;
            ctx.stroke();

        }

    }

    /*------------------ nucleotides and particles -----------------*/

    function createParticle(spreadY) {

        const isLetter = Math.random() < 0.3;

        return {
            x: rand(0, W),
            y: spreadY ? rand(0, H) : H + 20,
            z: rand(0.3, 1),
            r: rand(0.6, 2),
            vy: rand(-14, -4),
            vx: rand(-3, 3),
            letter: isLetter ? pick(LETTERS) : null,
            alpha: isLetter ? rand(0.06, 0.16) : rand(0.15, 0.45),
            wobble: rand(0, Math.PI * 2)
        };

    }

    function drawParticle(p) {

        const x = p.x + Math.sin(p.wobble) * 6 + pointerX * 8 * p.z;
        const y = p.y + pointerY * 6 * p.z;

        if (p.letter) {

            const color = BASE_COLORS[p.letter];
            ctx.fillStyle = `rgba(${color},${p.alpha})`;
            ctx.font = `600 ${Math.round(10 + p.z * 10)}px Poppins, sans-serif`;
            ctx.fillText(p.letter, x, y);

        } else {

            ctx.fillStyle = `rgba(0,229,255,${p.alpha * p.z})`;
            ctx.beginPath();
            ctx.arc(x, y, p.r * p.z, 0, Math.PI * 2);
            ctx.fill();

        }

    }

    /*-------------------------- loop --------------------------*/

    function resize() {

        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;

        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Fewer elements on small screens
        const helixCount = W < 600 ? 4 : W < 1100 ? 6 : 9;
        const particleCount = W < 600 ? 25 : 55;

        helices = Array.from({ length: helixCount }, () => createHelix(true));
        particles = Array.from({ length: particleCount }, () => createParticle(true));

        // Draw far fragments first so near ones overlap them
        helices.sort((a, b) => a.z - b.z);

    }

    function update(dt) {

        for (const h of helices) {

            h.phase += h.spin * dt;
            h.x += h.vx * h.z * dt;
            h.y += h.vy * h.z * dt;

            const pad = 300;
            if (h.x < -pad) h.x = W + pad;
            if (h.x > W + pad) h.x = -pad;

        }

        for (let i = 0; i < particles.length; i++) {

            const p = particles[i];
            p.y += p.vy * p.z * dt;
            p.x += p.vx * dt;
            p.wobble += dt * 0.8;

            if (p.y < -30 || p.x < -30 || p.x > W + 30) {
                particles[i] = createParticle(false);
            }

        }

    }

    function render() {

        ctx.clearRect(0, 0, W, H);
        for (const p of particles) drawParticle(p);
        for (const h of helices) drawHelix(h);

    }

    function frame(now) {

        if (!running) return;

        // Clamp so a long pause doesn't make everything jump
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        update(dt);
        render();
        requestAnimationFrame(frame);

    }

    /*-------------------------- events --------------------------*/

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resize();
            if (reduceMotion) render();
        }, 150);
    });

    window.addEventListener('scroll', () => {
        scrollY = window.scrollY;
        if (reduceMotion) render();
    }, { passive: true });

    if (!reduceMotion) {

        window.addEventListener('pointermove', (e) => {
            pointerX = e.clientX / W - 0.5;
            pointerY = e.clientY / H - 0.5;
        }, { passive: true });

        document.addEventListener('visibilitychange', () => {
            running = !document.hidden;
            if (running) {
                lastTime = performance.now();
                requestAnimationFrame(frame);
            }
        });

    }

    resize();

    if (reduceMotion) {
        render();
    } else {
        requestAnimationFrame(frame);
    }

})();
