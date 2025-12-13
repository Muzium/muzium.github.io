// Character page specific functionality
document.addEventListener('DOMContentLoaded', function() {
    initIllustrationSwitcher();
    initEulaModal();
    initVoiceSamples();
});

// Illustration thumbnail switcher
function initIllustrationSwitcher() {
    const thumbButtons = document.querySelectorAll('.thumb-btn');
    const currentIllust = document.getElementById('current-illust');
    
    thumbButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            thumbButtons.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update main illustration
            const imageSrc = this.getAttribute('data-image');
            if (currentIllust && imageSrc) {
                currentIllust.src = imageSrc;
            }
        });
    });
}

// EULA Modal functionality
let currentDownloadImage = null;

function downloadIllust() {
    const modal = document.getElementById('eula-modal');
    const currentIllust = document.getElementById('current-illust');
    
    if (currentIllust) {
        currentDownloadImage = currentIllust.src;
        modal.classList.add('active');
    }
}

function closeEulaModal() {
    const modal = document.getElementById('eula-modal');
    const checkbox = document.getElementById('eula-agree');
    
    modal.classList.remove('active');
    checkbox.checked = false;
    updateConfirmButton();
    currentDownloadImage = null;
}

function initEulaModal() {
    const checkbox = document.getElementById('eula-agree');
    const confirmBtn = document.getElementById('confirm-download');
    const modal = document.getElementById('eula-modal');
    
    // Enable/disable confirm button based on checkbox
    checkbox.addEventListener('change', updateConfirmButton);
    
    // Confirm download action
    confirmBtn.addEventListener('click', function() {
        if (currentDownloadImage && checkbox.checked) {
            // Create temporary link to download image
            const link = document.createElement('a');
            link.href = currentDownloadImage;
            link.download = currentDownloadImage.split('/').pop();
            link.click();
            
            // Close modal
            closeEulaModal();
        }
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeEulaModal();
        }
    });
}

function updateConfirmButton() {
    const checkbox = document.getElementById('eula-agree');
    const confirmBtn = document.getElementById('confirm-download');
    
    if (confirmBtn) {
        confirmBtn.disabled = !checkbox.checked;
    }
}

// Voice sample waveform visualization
function initVoiceSamples() {
    const voiceSamples = document.querySelectorAll('.voice-sample');
    
    voiceSamples.forEach(sample => {
        const canvas = sample.querySelector('.waveform-canvas');
        if (canvas) {
            drawPixelatedWaveform(canvas);
        }
    });
}

function drawPixelatedWaveform(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    // Generate sample waveform data
    const barCount = 100;
    const barWidth = width / barCount;
    const centerY = height / 2;
    
    // Draw pixelated waveform
    for (let i = 0; i < barCount; i++) {
        // Generate pseudo-random waveform pattern
        const amplitude = Math.sin(i * 0.1) * 0.5 + Math.random() * 0.5;
        const barHeight = amplitude * centerY;
        
        // Pixelate the height (round to nearest 4 pixels)
        const pixelatedHeight = Math.round(barHeight / 4) * 4;
        
        const x = i * barWidth;
        const characterColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--character-color').trim() || '#FFB600';
        
        ctx.fillStyle = characterColor;
        
        // Draw positive waveform
        ctx.fillRect(x, centerY - pixelatedHeight, barWidth - 1, pixelatedHeight);
        
        // Draw negative waveform
        ctx.fillRect(x, centerY, barWidth - 1, pixelatedHeight);
    }
}

// Play voice sample
function playVoiceSample(button, audioUrl) {
    // This would connect to the global audio player
    // For now, just show a placeholder
    console.log('Playing voice sample:', audioUrl);
    
    // You could integrate with the main player like this:
    // if (typeof loadTrack === 'function') {
    //     loadTrack(audioUrl, 'Voice Sample');
    // }
}

// Resize waveforms on window resize
window.addEventListener('resize', function() {
    const waveformCanvases = document.querySelectorAll('.waveform-canvas');
    waveformCanvases.forEach(canvas => {
        drawPixelatedWaveform(canvas);
    });
});
