document.addEventListener('DOMContentLoaded', () => {
    // State variables
    const themePlayers = [new Audio(), new Audio()];
    let activeThemePlayerIndex = -1;
    const overlayPlayers = new Map();
    let currentFadeInterval = null;

    // DOM Elements
    const themesContainer = document.getElementById('themes-container');
    const overlaysContainer = document.getElementById('overlays-container');
    const volumeSlider = document.getElementById('volume-slider');

    // --- Core Functions ---

    // Fetch sound data and build UI
    async function setup() {
        try {
            const response = await fetch('sounds.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            buildUI(data);
        } catch (error) {
            console.error("Could not load sounds data:", error);
            if (themesContainer) {
                themesContainer.innerHTML = '<p style="color: #f87171;">Errore nel caricamento della configurazione audio.</p>';
            }
        }
    }

    // Build UI from data
    function buildUI({ themes, overlays }) {
        if (!themesContainer || !overlaysContainer) return;

        themes.forEach(theme => {
            const button = document.createElement('button');
            button.textContent = theme.name;
            button.dataset.path = theme.path;
            button.dataset.id = theme.id;
            themesContainer.appendChild(button);
        });

        overlays.forEach(overlay => {
            const controlContainer = document.createElement('div');
            controlContainer.className = 'overlay-control';

            const button = document.createElement('button');
            button.textContent = overlay.name;
            button.dataset.path = overlay.path;
            button.dataset.id = overlay.id;
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = "0";
            slider.max = "100";
            slider.value = (overlay.defaultVolume || 0.7) * 100;
            slider.className = 'volume-slider';
            slider.dataset.id = overlay.id;

            controlContainer.appendChild(button);
            controlContainer.appendChild(slider);
            overlaysContainer.appendChild(controlContainer);
        });
    }
    
    // --- Event Handlers ---

    function handleThemeClick(e) {
        const button = e.target.closest('button');
        if (!button || !themesContainer.contains(button)) return;

        // Prevent switching to the same theme
        if (button.classList.contains('active')) return;

        const newPath = button.dataset.path;
        const targetVolume = volumeSlider.value / 100;

        // Update button states
        themesContainer.querySelectorAll('button.active').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Determine which audio player to use
        const oldPlayerIndex = activeThemePlayerIndex;
        const newPlayerIndex = (activeThemePlayerIndex + 1) % 2;
        
        const newPlayer = themePlayers[newPlayerIndex];
        newPlayer.src = newPath;
        newPlayer.loop = true;
        newPlayer.volume = 0;
        newPlayer.play().catch(e => console.error("Error playing audio:", e));
        
        activeThemePlayerIndex = newPlayerIndex;
        const oldPlayer = oldPlayerIndex !== -1 ? themePlayers[oldPlayerIndex] : null;
        
        fade(oldPlayer, newPlayer, targetVolume);
    }

    function handleOverlayClick(e) {
        const button = e.target.closest('button');
        if (!button || !e.currentTarget.contains(button)) return;
        
        const id = button.dataset.id;

        if (overlayPlayers.has(id)) {
            // It's active, so stop it
            const player = overlayPlayers.get(id);
            player.pause();
            overlayPlayers.delete(id);
            button.classList.remove('active');
        } else {
            // It's not active, so start it
            const path = button.dataset.path;
            const slider = overlaysContainer.querySelector(`input[data-id="${id}"]`);
            const player = new Audio(path);
            player.loop = true;
            player.volume = slider ? slider.value / 100 : 0.7;
            player.play().catch(e => console.error("Error playing overlay:", e));
            overlayPlayers.set(id, player);
            button.classList.add('active');
        }
    }
    
    function handleOverlayVolumeChange(e) {
        const slider = e.target;
        if (slider.type !== 'range' || !e.currentTarget.contains(slider)) return;

        const id = slider.dataset.id;
        if (overlayPlayers.has(id)) {
            const player = overlayPlayers.get(id);
            player.volume = slider.value / 100;
        }
    }


    function handleVolumeChange() {
        if (activeThemePlayerIndex !== -1) {
            const activePlayer = themePlayers[activeThemePlayerIndex];
            // Don't interrupt an active fade-in
            if (!currentFadeInterval) {
                 activePlayer.volume = volumeSlider.value / 100;
            }
        }
    }

    // --- Audio Logic ---

    function fade(fadeOutPlayer, fadeInPlayer, targetVolume) {
        if (currentFadeInterval) {
            clearInterval(currentFadeInterval);
        }
        
        const fadeDuration = 2000; // 2 seconds
        const tick = 50; // ms
        const steps = fadeDuration / tick;
        const stepIn = targetVolume / steps;
        // Calculate stepOut based on the player's current volume to handle fades started mid-fade
        const stepOut = fadeOutPlayer ? fadeOutPlayer.volume / steps : 0;

        currentFadeInterval = setInterval(() => {
            let fadeInComplete = false;
            let fadeOutComplete = false;
            
            // Fade in the new player
            if (fadeInPlayer.volume < targetVolume) {
                 fadeInPlayer.volume = Math.min(targetVolume, fadeInPlayer.volume + stepIn);
            } else {
                 fadeInPlayer.volume = targetVolume;
                 fadeInComplete = true;
            }

            // Fade out the old player
            if (fadeOutPlayer && fadeOutPlayer.volume > 0) {
                fadeOutPlayer.volume = Math.max(0, fadeOutPlayer.volume - stepOut);
            } else {
                fadeOutComplete = true;
            }

            // End condition
            if (fadeInComplete && fadeOutComplete) {
                if (fadeOutPlayer) {
                    fadeOutPlayer.pause();
                    fadeOutPlayer.src = ""; // Release resources
                }
                clearInterval(currentFadeInterval);
                currentFadeInterval = null;
            }
        }, tick);
    }
    
    // --- Initialization ---

    // Add event listeners using delegation
    if (themesContainer) themesContainer.addEventListener('click', handleThemeClick);
    if (overlaysContainer) {
        overlaysContainer.addEventListener('click', handleOverlayClick);
        overlaysContainer.addEventListener('input', handleOverlayVolumeChange);
    }
    if (volumeSlider) volumeSlider.addEventListener('input', handleVolumeChange);

    setup();
});