/* 陶板屋 菜單導覽：跳轉分頁時的「掀月曆」動畫
   頁面從右下角被掀起，沿著斜線一路往左上角翻開，底下提前露出下一頁，掀完後無縫換頁。 */
(function () {
    var root = document.documentElement;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var PEEL_MS = 750;

    // 作為底下預覽頁載入時（網址帶 ?preview），不啟用任何翻頁行為
    if (/[?&]preview\b/.test(location.search)) {
        root.classList.add('is-preview'); // 預覽頁不顯示自己的捲軸，畫面上永遠只有一條
        return;
    }
    if (reduceMotion) return;

    /* ---------- 底下的下一頁預覽 ---------- */
    var peek = null, peekHref = '';

    function preload(href) {
        if (!peek) {
            peek = document.createElement('iframe');
            peek.className = 'peek-frame';
            peek.setAttribute('aria-hidden', 'true');
            peek.setAttribute('tabindex', '-1');
            peek.title = '下一頁預覽';
            document.body.appendChild(peek);
        }
        if (peekHref !== href) {
            peekHref = href;
            peek.src = href + (href.indexOf('?') === -1 ? '?' : '&') + 'preview';
        }
    }

    /* ---------- 幾何工具 ---------- */
    // 用直線 x + y = d 切割多邊形；keepBelow 為 true 時保留 x + y < d 的一側
    function cut(poly, d, keepBelow) {
        var out = [];
        for (var i = 0; i < poly.length; i++) {
            var a = poly[i], b = poly[(i + 1) % poly.length];
            var fa = a[0] + a[1] - d, fb = b[0] + b[1] - d;
            var inA = keepBelow ? fa <= 0 : fa >= 0;
            var inB = keepBelow ? fb <= 0 : fb >= 0;
            if (inA) out.push(a);
            if (inA !== inB) {
                var t = fa / (fa - fb);
                out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
        }
        return out;
    }

    // 把被掀起的部分沿折線鏡射，得到紙張背面（翻起的那一片）
    function reflect(poly, d) {
        return poly.map(function (p) { return [d - p[1], d - p[0]]; });
    }

    function toClip(poly, offY) {
        if (poly.length < 3) return 'polygon(0 0, 0 0, 0 0)';
        return 'polygon(' + poly.map(function (p) {
            return p[0].toFixed(1) + 'px ' + (p[1] + offY).toFixed(1) + 'px';
        }).join(', ') + ')';
    }

    function ease(t) { // 起手慢慢掀起，之後加速翻走
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /* ---------- 掀頁 ---------- */
    function peel(page, done) {
        var W = window.innerWidth, H = window.innerHeight;
        var offY = window.scrollY - page.offsetTop; // 換算到 .page 自己的座標
        var rect = [[0, 0], [W, 0], [W, H], [0, H]];
        var total = W + H;

        var wrap = document.createElement('div');
        wrap.className = 'peel-wrap';
        var flap = document.createElement('div');
        flap.className = 'peel-flap';
        wrap.appendChild(flap);
        document.body.appendChild(wrap);
        root.classList.add('peeling');

        var start = null;
        function frame(now) {
            if (start === null) start = now;
            var t = Math.min((now - start) / PEEL_MS, 1);
            var d = total * (1 - ease(t)) + 1;

            // 留在牆上的部分
            page.style.clipPath = toClip(cut(rect, d, true), offY);

            // 被掀開的區域：只有這裡露出下一頁，未掀開的部分仍完整顯示目前頁面，兩頁不會重疊
            var peeled = cut(rect, d, false);
            if (peek) peek.style.clipPath = t < 1 ? toClip(peeled, 0) : 'none';

            // 翻起來的紙背
            var lifted = reflect(peeled, d);
            flap.style.clipPath = toClip(lifted, 0);
            var fold = d / Math.SQRT2; // 折線在 135° 漸層上的位置
            flap.style.background =
                'linear-gradient(135deg, #f6f2fa ' + (fold - 260) + 'px, #e9e0f3 ' + (fold - 60) + 'px, #d3c4e4 ' + (fold - 4) + 'px, #f8f5fb ' + fold + 'px)';

            if (t < 1) requestAnimationFrame(frame);
            else done();
        }
        requestAnimationFrame(frame);
    }

    document.addEventListener('DOMContentLoaded', function () {
        var page = document.querySelector('.page');
        if (!page) return;
        var busy = false;
        var hoverTimer = null;

        function internalLink(e) {
            var a = e.target.closest && e.target.closest('a[href]');
            if (!a || a.target === '_blank') return null;
            var href = a.getAttribute('href');
            if (!/\.html(\?|#|$)/.test(href) || /^https?:/i.test(href)) return null; // 只處理站內頁面
            return a;
        }

        // 滑鼠停在連結上時就先在背後載入下一頁，掀開時底下馬上看得到
        document.addEventListener('pointerover', function (e) {
            var a = internalLink(e);
            if (!a || busy || a.getAttribute('aria-current') === 'page') return;
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(function () { preload(a.href); }, 120);
        });

        document.addEventListener('click', function (e) {
            var a = internalLink(e);
            if (!a) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

            e.preventDefault();
            if (busy || a.getAttribute('aria-current') === 'page') return;
            busy = true;
            clearTimeout(hoverTimer);
            preload(a.href);
            peek.classList.add('show');
            peel(page, function () { location.href = a.href; });
        });
    });

    /* 從瀏覽器「上一頁」返回時（bfcache），把掀到一半的頁面復原 */
    window.addEventListener('pageshow', function (e) {
        if (!e.persisted || !document.querySelector('.peel-wrap')) return;
        var page = document.querySelector('.page');
        if (page) page.style.clipPath = '';
        var w = document.querySelector('.peel-wrap');
        if (w) w.remove();
        root.classList.remove('peeling');
        location.reload(); // 重新綁定狀態最單純可靠
    });
})();
