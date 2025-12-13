// Global state
let currentAudio = null;
let isPlaying = false;
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initMusicPlayer();
    initBackToTop();
});

// Navigation functionality
function initNavigation() {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && document.querySelector(href)) {
                e.preventDefault();
                document.querySelector(href).scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Music Player functionality
function initMusicPlayer() {
    const playerToggle = document.getElementById('player-toggle');
    const playerContent = document.getElementById('player-content');
    const playPauseBtn = document.getElementById('play-pause');
    const downloadBtn = document.getElementById('download-track');
    const progressBar = document.getElementById('progress-bar');
    const canvas = document.getElementById('spectrum-canvas');
    
    // Toggle player visibility
    playerToggle.addEventListener('click', function() {
        playerContent.classList.toggle('hidden');
        this.classList.toggle('collapsed');
    });
    
    // Play/Pause functionality
    playPauseBtn.addEventListener('click', function() {
        if (!currentAudio) {
            // Load default track or show message
            updateTrackInfo('暂无音乐', '0:00', '0:00');
            return;
        }
        
        if (isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
    });
    
    // Download functionality
    downloadBtn.addEventListener('click', function() {
        if (currentAudio && currentAudio.src) {
            const link = document.createElement('a');
            link.href = currentAudio.src;
            link.download = document.getElementById('track-name').textContent || 'track.mp3';
            link.click();
        }
    });
    
    // Progress bar functionality
    progressBar.addEventListener('input', function() {
        if (currentAudio) {
            const time = (this.value / 100) * currentAudio.duration;
            currentAudio.currentTime = time;
        }
    });
    
    // Initialize spectrum canvas
    initSpectrum(canvas);
}

// Initialize audio spectrum visualization
function initSpectrum(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;
    
    // Draw initial empty spectrum
    drawSpectrum(ctx, width, height, null);
}

// Draw pixelated spectrum
function drawSpectrum(ctx, width, height, dataArray) {
    ctx.clearRect(0, 0, width, height);
    
    if (!dataArray) {
        // Draw empty spectrum
        ctx.fillStyle = '#333';
        const barCount = 100;
        const barWidth = width / barCount;
        
        for (let i = 0; i < barCount; i++) {
            const x = i * barWidth;
            ctx.fillRect(x, height - 5, barWidth - 2, 5);
        }
        return;
    }
    
    // Draw actual spectrum data
    const barCount = 100;
    const barWidth = width / barCount;
    const step = Math.floor(dataArray.length / barCount);
    
    for (let i = 0; i < barCount; i++) {
        const dataIndex = i * step;
        const value = dataArray[dataIndex] || 0;
        const barHeight = (value / 255) * height;
        
        // Pixelated effect - round to nearest 5 pixels
        const pixelatedHeight = Math.round(barHeight / 5) * 5;
        
        const x = i * barWidth;
        const hue = (i / barCount) * 60 + 40; // Yellow to orange range
        ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        
        ctx.fillRect(x, height - pixelatedHeight, barWidth - 2, pixelatedHeight);
    }
}

// Animation loop for spectrum
function animateSpectrum() {
    if (!analyser || !isPlaying) return;
    
    analyser.getByteFrequencyData(dataArray);
    
    const canvas = document.getElementById('spectrum-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    drawSpectrum(ctx, width, height, dataArray);
    
    animationId = requestAnimationFrame(animateSpectrum);
}

// Play audio
function playAudio() {
    if (!currentAudio) return;
    
    currentAudio.play();
    isPlaying = true;
    document.getElementById('play-pause').textContent = '⏸';
    
    // Initialize audio context if not already done
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaElementSource(currentAudio);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        
        source.connect(analyser);
        analyser.connect(audioContext.destination);
    }
    
    animateSpectrum();
}

// Pause audio
function pauseAudio() {
    if (!currentAudio) return;
    
    currentAudio.pause();
    isPlaying = false;
    document.getElementById('play-pause').textContent = '▶';
    
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Update track info display
function updateTrackInfo(name, currentTime, duration) {
    document.getElementById('track-name').textContent = name;
    document.getElementById('track-time').textContent = `${currentTime} / ${duration}`;
}

// Format time from seconds to mm:ss
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Load audio track
function loadTrack(url, name) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    currentAudio = new Audio(url);
    
    currentAudio.addEventListener('loadedmetadata', function() {
        updateTrackInfo(name, '0:00', formatTime(this.duration));
    });
    
    currentAudio.addEventListener('timeupdate', function() {
        const progress = (this.currentTime / this.duration) * 100;
        document.getElementById('progress-bar').value = progress;
        updateTrackInfo(name, formatTime(this.currentTime), formatTime(this.duration));
    });
    
    currentAudio.addEventListener('ended', function() {
        isPlaying = false;
        document.getElementById('play-pause').textContent = '▶';
        document.getElementById('progress-bar').value = 0;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    });
}

// Back to top functionality
function initBackToTop() {
    const backToTopBtn = document.getElementById('back-to-top');
    
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            backToTopBtn.style.display = 'block';
        } else {
            backToTopBtn.style.display = 'none';
        }
    });
    
    backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Character section hover effects
document.addEventListener('DOMContentLoaded', function() {
    const sections = document.querySelectorAll('.character-section');
    
    sections.forEach(section => {
        const color = section.getAttribute('data-color');
        
        section.addEventListener('mouseenter', function() {
            this.style.setProperty('--section-accent', color);
        });
    });
});
