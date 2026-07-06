import { PaperDimensions } from './paperSize';

/**
 * Injects html2canvas capture script into the same receipt HTML used by QZ Tray / web print.
 * Output PNG width is scaled to thermal printer dot width (bleImageWidthPx).
 */
export function buildReceiptRasterHtml(fullReceiptHtml: string, paper: PaperDimensions): string {
    const scale = (paper.bleImageWidthPx / paper.widthPx).toFixed(3);
    const script = `
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>
<script>
(function () {
  function send(ok, data, error) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ ok: ok, data: data, error: error }));
    }
  }

  function capture() {
    if (!window.html2canvas) {
      send(false, null, 'html2canvas tidak termuat');
      return;
    }

    html2canvas(document.body, {
      scale: ${scale},
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: ${paper.widthPx},
      windowWidth: ${paper.widthPx},
    }).then(function (canvas) {
      send(true, canvas.toDataURL('image/png', 1.0), null);
    }).catch(function (err) {
      send(false, null, String(err));
    });
  }

  function waitForImages() {
    var imgs = Array.prototype.slice.call(document.images || []);
    if (!imgs.length) {
      setTimeout(capture, 120);
      return;
    }

    var pending = imgs.length;
    var done = function () {
      pending -= 1;
      if (pending <= 0) {
        setTimeout(capture, 120);
      }
    };

    imgs.forEach(function (img) {
      if (img.complete) {
        done();
      } else {
        img.onload = done;
        img.onerror = done;
      }
    });
  }

  if (document.readyState === 'complete') {
    waitForImages();
  } else {
    window.addEventListener('load', waitForImages);
  }
})();
<\/script>`;

    if (fullReceiptHtml.includes('</body>')) {
        return fullReceiptHtml.replace('</body>', `${script}</body>`);
    }

    return `${fullReceiptHtml}${script}`;
}