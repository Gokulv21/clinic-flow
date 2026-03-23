/**
 * printPrescription
 * ─────────────────
 * Renders multiple prescription pages by cloning them into a temporary container
 * and triggering the native print dialog. This approach is highly reliable on mobile/tablets.
 */
export function printPrescription(selector: string = '.print-container'): void {
    const container = document.querySelector(selector);
    if (!container) {
        console.error('[printPrescription] .print-container not found');
        return;
    }

    // ── 1. Preparation: Clone the container ──────────────────────────
    const printMount = document.createElement('div');
    printMount.id = 'print-mount';
    // Style it correctly for print
    printMount.style.cssText = 'position:fixed;top:0;left:0;width:100%;opacity:0;z-index:-9999;pointer-events:none;background:white;';
    
    // Deep clone the container instead of just innerHTML
    const clone = container.cloneNode(true) as HTMLElement;
    clone.id = 'prescription-to-print-cloned';
    printMount.appendChild(clone);
    
    // Insert at the VERY BEGINNING of body to prevent layout space from above elements
    document.body.insertBefore(printMount, document.body.firstChild);
    document.body.classList.add('is-printing');

    // ── 2. Trigger Print ────────────────────────────────────────────
    const monitorImagesAndPrint = async () => {
        const images = Array.from(printMount.querySelectorAll('img'));
        
        // Wait for all images to be 'complete'
        await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve; // Continue regardless
            });
        }));

        // Final buffer for rendering engine
        await new Promise(r => setTimeout(r, 500));
        
        window.print();
        
        // ── 3. Cleanup ─────────────────────────────────────────────
        setTimeout(() => {
            document.body.classList.remove('is-printing');
            if (document.getElementById('print-mount')) {
                document.body.removeChild(printMount);
            }
        }, 1500); 
    };

    // Initial settle time for DOM injection
    setTimeout(monitorImagesAndPrint, 500);
}
