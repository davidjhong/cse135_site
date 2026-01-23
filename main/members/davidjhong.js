document.addEventListener('DOMContentLoaded', () => {
    initFunFactGenerator();
    initAccordions();
});

/* --- Fun Fact Generator Logic --- */
function initFunFactGenerator() {
    const facts = [
        "I once debugged a server issue for 6 hours only to find a missing semicolon.",
        "I'm an avid hiker and have visited 3 different national parks this year.",
        "I can type 110 words per minute on a mechanical keyboard.",
        "I build custom PCs as a hobby in my spare time."
    ];

    const factDisplay = document.getElementById('fact-display');
    const factBtn = document.getElementById('fact-btn');
    
    let lastIndex = -1;

    factBtn.addEventListener('click', () => {
        let newIndex;
        
        // Ensure we don't repeat the immediate previous fact
        do {
            newIndex = Math.floor(Math.random() * facts.length);
        } while (newIndex === lastIndex && facts.length > 1);

        lastIndex = newIndex;

        // Animate Out
        factDisplay.classList.add('fact-animating');

        // Wait for fade out, then swap text and fade in
        setTimeout(() => {
            factDisplay.textContent = facts[newIndex];
            factDisplay.style.borderColor = getRandomColor(); // Subtle highlight change
            factDisplay.classList.remove('fact-animating');
        }, 300);
    });
}

// Helper for subtle color variation on the fact box border
function getRandomColor() {
    const colors = ['#38bdf8', '#818cf8', '#34d399', '#f472b6'];
    return colors[Math.floor(Math.random() * colors.length)];
}

/* --- Accordion Logic --- */
function initAccordions() {
    // Select all triggers inside sections
    const triggers = document.querySelectorAll('.accordion-trigger');

    triggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            const currentButton = e.currentTarget;
            const isExpanded = currentButton.getAttribute('aria-expanded') === 'true';
            const section = currentButton.closest('.accordion-section');
            
            // 1. Close all other items IN THIS SPECIFIC SECTION
            const sectionTriggers = section.querySelectorAll('.accordion-trigger');
            sectionTriggers.forEach(btn => {
                if (btn !== currentButton) {
                    btn.setAttribute('aria-expanded', 'false');
                }
            });

            // 2. Toggle the clicked item
            currentButton.setAttribute('aria-expanded', !isExpanded);
        });

        // Keyboard accessibility: Enable Space/Enter if button doesn't inherently handle it (buttons usually do)
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                trigger.click();
            }
        });
    });
}