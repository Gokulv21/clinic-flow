/**
 * printPrescription
 * ─────────────────
 * Renders multiple prescription pages by cloning them into a temporary container
 * and triggering the native print dialog. This approach is highly reliable on mobile/tablets.
 */
export function printPrescription(selector: string = '.print-container'): void {
    // ── 0. Setup/Reuse Persistent Print Mount ────────────────────────
    let printMount = document.getElementById('print-mount');
    if (!printMount) {
        printMount = document.createElement('div');
        printMount.id = 'print-mount';
        // Ensure it's hidden from screen but visible to print engine
        printMount.style.cssText = 'position:fixed;top:0;left:0;width:100%;opacity:0;z-index:-99999;pointer-events:none;background:white;';
        document.body.insertBefore(printMount, document.body.firstChild);
    }
    
    // Clear any previous content
    printMount.innerHTML = '';

    const container = document.querySelector(selector);
    if (!container) {
        console.error('[printPrescription] .print-container not found');
        return;
    }

    // ── 1. Preparation: Clone the container ──────────────────────────
    // Inject a style tag to ensure visibility during print
    const style = document.createElement('style');
    style.innerHTML = `
        @media print {
            #print-mount { 
                display: block !important; 
                visibility: visible !important; 
                opacity: 1 !important; 
                position: relative !important;
                z-index: 99999 !important;
            }
        }
    `;
    printMount.appendChild(style);

    // Deep clone the container
    const clone = container.cloneNode(true) as HTMLElement;
    clone.id = 'prescription-to-print-cloned';
    printMount.appendChild(clone);
    
    // ── 2. Trigger Print ────────────────────────────────────────────
    const monitorImagesAndPrint = async () => {
        const images = Array.from(printMount!.querySelectorAll('img'));
        
        // Wait for all images to settle
        await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
            });
        }));

        // Final buffer for rendering engine
        await new Promise(r => setTimeout(r, 500));
        
        // No more flaky 'afterprint' or short timeouts.
        // The aggressive CSS shield in index.css handles hiding the background 
        // as long as #print-mount is not empty.
        
        window.print();

        // ── 3. Delayed Cleanup ─────────────────────────────────────────
        // We keep the content in #print-mount for 30 minutes to support 
        // slow format changes or long print dialog sessions.
        // It will be purged automatically the next time printPrescription is called anyway.
        const currentMount = printMount;
        setTimeout(() => {
            if (currentMount && currentMount.innerHTML !== '') {
                console.log('[printPrescription] Purging stale print content.');
                currentMount.innerHTML = '';
            }
        }, 1800000); // 30 minutes
    };

    setTimeout(monitorImagesAndPrint, 300);
}
