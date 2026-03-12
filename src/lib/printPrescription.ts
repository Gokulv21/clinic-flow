/**
 * printPrescription
 * ─────────────────
 * Renders the prescription in a hidden iframe and prints it.
 *
 * Key design decisions:
 *  1. iframe instead of window.print() — avoids visibility:hidden tricks and
 *     container-query font-size zero-size bugs in browser print engines.
 *  2. Handwriting overlay as an injected <img> tag.
 */
export function printPrescription(): void {
    const el = document.getElementById('prescription-template');
    if (!el) {
        console.error('[printPrescription] #prescription-template not found');
        return;
    }

    // ── Capture handwriting data URL BEFORE stripping the img ─────────
    const hwImg = el.querySelector('img[alt="handwriting"]') as HTMLImageElement | null;
    const hwSrc = hwImg?.src ?? '';

    // ── Get template HTML with typed data and structure ────────────────
    let html = el.outerHTML;

    // ── Inject handwriting as a standard <img> tag ─────────────────────
    // If handwriting exists, we append it directly to the HTML string.
    // This is robust: simple <img> tags with absolute positioning work
    // flawlessly in all print engines, avoiding background-image issues.
    if (hwSrc) {
        // Remove the old img tag from the HTML string so we don't duplicate
        html = html.replace(/<img[^>]+alt="handwriting"[^>]*>/i, '');
        // Append a fresh, clean img tag just inside the closing </div>
        const imgTag = `<img src="${hwSrc}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:fill;z-index:99;pointer-events:none;" alt="handwriting">`;
        html = html.replace(/<\/div>\s*$/i, `${imgTag}</div>`);
    }

    // ── Create hidden iframe ───────────────────────────────────────────
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;border:none;opacity:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Prescription</title>
<style>
/* ── Reset ─────────────────────────────────────────────────────── */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #fff; }

/* ── Template container ─────────────────────────────────────────── */
#prescription-template {
    width: 210mm !important;
    height: 297mm !important;
    position: relative !important;
    overflow: hidden !important;
    box-shadow: none !important;
    aspect-ratio: unset !important;
    /* container-type: inline-size is already in the inline style,
       enabling cqw units for children */
}

/* ── Inner wrapper: override cqw font with absolute mm value ────── */
#rx-inner {
    font-size: 3.15mm !important;   /* = 1.5% × 210mm */
    position: absolute !important;
    inset: 0 !important;
    overflow: hidden !important;
}

/* ── Print ──────────────────────────────────────────────────────── */
@page { margin: 0; size: A4 portrait; }
@media print {
    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    html, body { margin: 0; padding: 0; }
    #prescription-template {
        width: 210mm !important;
        height: 297mm !important;
        position: relative !important;
        overflow: hidden !important;
    }
    #rx-inner { font-size: 3.15mm !important; }
}
</style>
</head>
<body>${html}</body>
</html>`);
    doc.close();

    // ── Print after allowing fonts + pseudo-element to render ─────────
    const doprint = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        const cleanup = () => {
            try { document.body.removeChild(iframe); } catch (_) { /* already removed */ }
        };
        iframe.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
        setTimeout(cleanup, 15_000); // fallback
    };

    if (doc.readyState === 'complete') {
        setTimeout(doprint, 700);
    } else {
        doc.addEventListener('DOMContentLoaded', () => setTimeout(doprint, 700));
    }
}
