/* 陶板屋 菜單導覽：秋葉飄落 + 鼠標紫色霧氣
   兩種特效的狀態都會在跳轉頁面時保留，下一頁接著播放，不會重新開始。 */
(function () {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(pointer: fine)').matches;
    if (reduceMotion) return; // 尊重「減少動態效果」的系統設定
    // 掀頁時底下的預覽頁不自己畫特效，改由目前頁面的特效持續疊在上方
    if (/[?&]preview\b/.test(location.search)) return;

    var STORE_KEY = 'autumn-fx';
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function makeCanvas(className) {
        var c = document.createElement('canvas');
        c.className = className;
        c.setAttribute('aria-hidden', 'true');
        document.body.appendChild(c);
        return c;
    }

    var leafCanvas = makeCanvas('fx-leaves');
    var mistCanvas = finePointer ? makeCanvas('fx-mist') : null;
    var lctx = leafCanvas.getContext('2d');
    var mctx = mistCanvas ? mistCanvas.getContext('2d') : null;
    var W = 0, H = 0;

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        [leafCanvas, mistCanvas].forEach(function (c) {
            if (!c) return;
            c.width = W * dpr;
            c.height = H * dpr;
            c.style.width = W + 'px';
            c.style.height = H + 'px';
            c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
        });
    }
    window.addEventListener('resize', resize);
    resize();

    /* ---------- 秋葉 ---------- */
    var shapes = [
        new Path2D('M50 4 L58 24 L72 15 L68 35 L92 30 L80 46 L98 56 L76 62 L82 80 L58 71 L53 96 L47 96 L42 71 L18 80 L24 62 L2 56 L20 46 L8 30 L32 35 L28 15 L42 24 Z'), // 楓葉
        new Path2D('M50 98 L50 62 C22 58 4 34 12 8 C26 18 40 15 50 24 C60 15 74 18 88 8 C96 34 78 58 50 62 Z')  // 銀杏
    ];
    var colors = ['#c98f74', '#d6ad6a', '#b9849a', '#a68bc4', '#cf9c7c', '#c4a9dc'];

    function newLeaf(initial) {
        return {
            x: Math.random() * W,
            y: initial ? Math.random() * H : -30 - Math.random() * 60,
            size: 12 + Math.random() * 14,
            vy: 0.35 + Math.random() * 0.55,
            sway: 0.6 + Math.random() * 1.2,
            phase: Math.random() * Math.PI * 2,
            rot: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.02,
            flip: Math.random() * Math.PI * 2,
            shapeIdx: Math.random() < 0.7 ? 0 : 1,
            color: colors[(Math.random() * colors.length) | 0],
            alpha: 0.35 + Math.random() * 0.3
        };
    }

    var leaves = [];
    var puffs = [];
    var last = { x: -999, y: -999 };

    /* ---------- 跳轉頁面時保留特效狀態 ---------- */
    function saveState() {
        try {
            sessionStorage.setItem(STORE_KEY, JSON.stringify({
                t: Date.now(), w: W, h: H, leaves: leaves, puffs: puffs, last: last
            }));
        } catch (e) {}
    }

    // 讀回上一頁留下的狀態，並補上載入期間經過的時間，讓動作自然銜接
    function restoreState() {
        var data;
        try { data = JSON.parse(sessionStorage.getItem(STORE_KEY)); } catch (e) { data = null; }
        if (!data || !data.leaves || !data.leaves.length) return false;

        var sx = W / data.w, sy = H / data.h;
        var frames = Math.min(Math.max((Date.now() - data.t) / 16.7, 0), 120);

        leaves = data.leaves.map(function (l) {
            l.x = l.x * sx + 0.15 * frames;
            l.y = l.y * sy + l.vy * frames;
            l.rot += l.vr * frames;
            l.flip += 0.02 * frames;
            return l;
        });

        puffs = (data.puffs || []).map(function (p) {
            p.x *= sx; p.y *= sy;
            p.life -= 0.018 * frames;
            p.r += 0.6 * frames;
            p.y -= 0.25 * frames;
            p.x += p.drift * frames;
            return p;
        }).filter(function (p) { return p.life > 0; });

        if (data.last) last = { x: data.last.x * sx, y: data.last.y * sy };
        return true;
    }

    if (!restoreState()) {
        var leafCount = W < 600 ? 10 : 18;
        for (var i = 0; i < leafCount; i++) leaves.push(newLeaf(true));
    }

    // 離開頁面（點連結、上一頁、重新整理）前存檔
    window.addEventListener('pagehide', saveState);
    // 用瀏覽器「上一頁／下一頁」回到快取中的頁面時，改用最新的狀態，而不是停留在當初離開的樣子
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) restoreState();
    });

    function drawLeaves(t) {
        lctx.clearRect(0, 0, W, H);
        leaves.forEach(function (l, idx) {
            l.y += l.vy;
            l.x += Math.sin(t / 1400 + l.phase) * l.sway * 0.5 + 0.15; // 微風往右
            l.rot += l.vr;
            l.flip += 0.02;
            if (l.y > H + 40 || l.x > W + 40) leaves[idx] = newLeaf(false);

            var s = l.size / 100;
            lctx.save();
            lctx.translate(l.x, l.y);
            lctx.rotate(l.rot);
            lctx.scale(s * Math.cos(l.flip), s); // 翻轉感
            lctx.translate(-50, -50);
            lctx.globalAlpha = l.alpha;
            lctx.fillStyle = l.color;
            lctx.fill(shapes[l.shapeIdx] || shapes[0]);
            lctx.restore();
        });
    }

    /* ---------- 鼠標紫霧 ---------- */
    if (mistCanvas) {
        window.addEventListener('pointermove', function (e) {
            var dx = e.clientX - last.x, dy = e.clientY - last.y;
            if (dx * dx + dy * dy < 36) return; // 移動夠遠才產生，避免過密
            last.x = e.clientX; last.y = e.clientY;
            puffs.push({
                x: e.clientX + (Math.random() - 0.5) * 10,
                y: e.clientY + (Math.random() - 0.5) * 10,
                r: 14 + Math.random() * 10,
                life: 1,
                drift: (Math.random() - 0.5) * 0.4
            });
            if (puffs.length > 60) puffs.shift();
        }, { passive: true });
    }

    function drawMist() {
        if (!mctx) return;
        mctx.clearRect(0, 0, W, H);
        for (var i = puffs.length - 1; i >= 0; i--) {
            var p = puffs[i];
            p.life -= 0.018;
            p.r += 0.6;
            p.y -= 0.25;
            p.x += p.drift;
            if (p.life <= 0) { puffs.splice(i, 1); continue; }
            var g = mctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            g.addColorStop(0, 'rgba(167, 139, 201, ' + (0.32 * p.life) + ')');
            g.addColorStop(0.5, 'rgba(199, 182, 220, ' + (0.18 * p.life) + ')');
            g.addColorStop(1, 'rgba(199, 182, 220, 0)');
            mctx.fillStyle = g;
            mctx.beginPath();
            mctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            mctx.fill();
        }
    }

    /* ---------- 動畫迴圈 ---------- */
    // 先立刻畫出第一格，新頁面一出現特效就在，不會有空白的一瞬間
    drawLeaves(performance.now());
    drawMist();

    var running = true;
    function loop(t) {
        if (!running) return;
        drawLeaves(t);
        drawMist();
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    document.addEventListener('visibilitychange', function () {
        running = !document.hidden;
        if (running) requestAnimationFrame(loop);
    });
})();
