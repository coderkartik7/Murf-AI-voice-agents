// Get DOM elements for TTS
const form = document.getElementById('ttsForm');
const textInput = document.getElementById('textInput');
const voiceSelect = document.getElementById('voiceSelect');
const generateBtn = document.getElementById('generateBtn');
const resultArea = document.getElementById('resultArea');
const charCount = document.getElementById('charCount');

// TTS Character counter functionality
if (textInput && charCount) {
    textInput.addEventListener('input', function() {
        const count = this.value.length;
        charCount.textContent = count;
        
        // Change color when approaching limit
        if (count > 4500) {
            charCount.style.color = '#dc354c';
        } else {
            charCount.style.color = 'inherit';
        }
    });
}

// TTS Form submission handler
if (form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const text = textInput.value.trim();
        const voiceId = voiceSelect.value;
        
        // Validate input
        if (!text) {
            showResult('Please enter some text!', 'error');
            return;
        }
        
        // Show loading state
        generateBtn.disabled = true;
        generateBtn.textContent = '🔄 Generating...';
        showLoading();
        
        try {
            // Make API request
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    voiceid: voiceId,
                    style: "Inspirational"
                })
            });
            
            const data = await response.json();
            
            // Handle response
            if (data.success) {
                showSuccess(data.audio_url, data.message);
            } else {
                showResult(data.error || 'Failed to generate speech', 'error');
            }
            
        } catch (error) {
            console.error('Error:', error);
            showResult('Network error. Please try again.', 'error');
        } finally {
            // Reset button state
            generateBtn.disabled = false;
            generateBtn.textContent = '🎵 Generate Speech';
        }
    });
}

// TTS Show loading animation
function showLoading() {
    if (resultArea) {
        resultArea.innerHTML = `
            <div class="loading"></div>
            <p>Generating your speech... Please wait</p>
        `;
    }
}

// TTS Show result message
function showResult(message, type) {
    if (resultArea) {
        const className = type === 'error' ? 'error-message' : 'success-message';
        resultArea.innerHTML = `<p class="${className}">${message}</p>`;
    }
}

// TTS Show success with audio player and download link
function showSuccess(audioUrl, message) {
    if (resultArea) {
        resultArea.innerHTML = `
            <p class="success-message">✅ ${message}</p>
            <audio controls>
                <source src="${audioUrl}" type="audio/mpeg">
                Your browser does not support the audio element.
            </audio>
            <a href="${audioUrl}" download="generated-speech.mp3" class="download-btn">
                📥 Download Audio
            </a>
        `;
    }
}


// =============================================================================
// ECHO BOT V2 FUNCTIONALITY - Now with Transcription + TTS
// =============================================================================


console.log("Echo Bot v2 script loaded");

// Echo Bot variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Get Echo Bot DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const audioPlayback = document.getElementById('audioPlayback');
const waveAnimation = document.getElementById('waveAnimation');

// Log element status
console.log("Echo Bot elements:", {
    startBtn: !!startBtn,
    stopBtn: !!stopBtn,
    status: !!status,
    audioPlayback: !!audioPlayback,
    waveAnimation: !!waveAnimation
});

// Initialize Echo Bot
function initEchoBot() {
    console.log("Initializing Echo Bot v2");
    
    // Set initial state
    if (stopBtn) stopBtn.disabled = true;
    if (waveAnimation) waveAnimation.style.display = 'none';
    if(status) {
        status.textContent = "Ready to Record ";
        status.clas = "status ready"
    }
    
    // Add event listeners
    if (startBtn) {
        startBtn.addEventListener('click', startRecording);
        console.log("Added click event to Start button");
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', stopRecording);
        console.log("Added click event to Stop button");
    }
}

// Echo Bot start recording function
async function startRecording() {
    console.log("Start recording called");
    
    try {
        console.log("Requesting microphone access...");
        
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation : true,
                noiseSuppression : true,
                sampleRate : 44100
            } 
        });
        console.log("Microphone access granted");

        // Initialize MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        console.log("MediaRecorder created");

        // Reset audio chunks
        audioChunks = [];
        isRecording = true;

        // Set up event listeners
        mediaRecorder.ondataavailable = (event) => {
            console.log("Data available event:", event.data.size);
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async() => {
            console.log("Recording stopped");
            // Create blob from chunks
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log("Audio blob created:", audioBlob.size, "bytes");

            await processEchoAudio(audioBlob);

            stream.getTracks(),forEach(track => track.stop());
            console.log("Microphone released");
            
        };

        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms
        console.log("MediaRecorder started");
        isRecording = true;

        // Update UI
        if (startBtn) {
            startBtn.disabled = true;
            console.log("Start button disabled");
        }
        if (stopBtn) {
            stopBtn.disabled = false;
            console.log("Stop button enabled");
        }
        if (status) {
            status.textContent = 'Recording... Speak into your microphone!';
            status.className = 'status recording';
            console.log("Status updated to 'recording'");
        }
        if (waveAnimation) {
            waveAnimation.style.display = 'flex';
            waveAnimation.classList.add('active');
            console.log("Wave animation activated");
        }
        if (audioPlayback) {
            audioPlayback.style.display = 'none';
            console.log("Audio playback hidden");
        }

    } catch (error) {
        console.error('Error accessing microphone:', error);
        if (status) {
            status.textContent = `Error: ${error.message}`;
            status.className = 'status error';
            console.log("Error status displayed");
        }
    }
}

// Echo Bot stop recording function
function stopRecording() {
    console.log("Stop recording called");
    
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        console.log("MediaRecorder stopped");

        // Update UI
        if (startBtn) {
            startBtn.disabled = false;
            console.log("Start button enabled");
        }
        if (stopBtn) {
            stopBtn.disabled = true;
            console.log("Stop button disabled");
        }
        if (status) {
            status.textContent = 'Processing your voice...Transcibing & Generating Ai voice';
            status.className = 'status';
            console.log("Status updated to processing");
        }
        if (waveAnimation) {
            waveAnimation.classList.remove('active');
            console.log("Wave animation deactivated");
        }
    }
}

// Process audio with the new /tts/echo endpoint
async function processEchoAudio(audioBlob) {
    try {
        // Update status to show upload in progress
        if (status) {
            status.textContent = '🎯 Step 1: Transcribing your speech...';
            status.className = 'status';
        }

        //Get selected voice from the TTS form
        const selectedVoice = voiceSelect? voiceSelect.value : "en-US-Daniel";
        console.log("Selected Voice:", selectedVoice);
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'echo_recording.webm');
        formData.append('voiceId', selectedVoice) 
        
        // Call the new echo endpoint
        console.log("Calling /tts/echo endpoint...")
        const response = await fetch('/tts/echo', {
            method: 'POST',
            body: formData
        });
        
        console.log("Response status:", response.status);
        if(!response.ok){
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Echo response:", data);
        
        if (data.success) {
            console.log("Echo processing successful!");
            // Update status to show transcription result
            if (status) {
                status.textContent = `🎤 You said: "${data.transcribed_text}"`;
                status.className = 'status ready';
            }
            
            // Set up audio playback with the AI-generated voice
            if (audioPlayback && data.audio_url) {
                audioPlayback.src = data.audio_url;
                audioPlayback.style.display = 'block';
                console.log("Audio playback updated with AI voice");
                
                // Add some visual feedback
                setTimeout(() => {
                    if (status) {
                        status.textContent = `✅ ${data.message} - Playing back in AI voice!`;
                        status.className = 'status ready';
                    }
                }, 500);
            }

            //Show download option in Echo Bot container
            showEchoDownload(data.transcribed_text, data.audio_url);
            
        } else {
            console.error("Echo processing failed:", data.error);
            if (status) {
                status.textContent = `❌ Error: ${data.error || 'Echo processing failed'}`;
                status.className = 'status error';
            }
        }
        
    } catch (error) {
        console.error('Echo processing error:', error);
        if (status) {
            status.textContent = `❌ Network error: ${error.message}`;
            status.className = 'status error';
        }
    }
}

function showEchoDownload(transcribedText, audioUrl) {
    // Create or update the download area in the Echo Bot container
    const audioContainer = document.querySelector('.audio-container');
    if (audioContainer) {
        // Check if download area already exists
        let downloadArea = document.getElementById('echoDownloadArea');
        if (!downloadArea) {
            downloadArea = document.createElement('div');
            downloadArea.id = 'echoDownloadArea';
            downloadArea.style.marginTop = '20px';
            audioContainer.appendChild(downloadArea);
        }
        
        downloadArea.innerHTML = `
            <div style="text-align: center; padding: 15px; background: rgba(76, 175, 80, 0.1); border-radius: 10px; border: 1px solid rgba(76, 175, 80, 0.3);">
                <p style="margin-bottom: 10px;"><strong>📝 Transcription:</strong></p>
                <p style="font-style: italic; margin-bottom: 15px;">"${transcribedText}"</p>
                <a href="${audioUrl}" download="echo-ai-voice.mp3" class="download-btn">
                    📥 Download AI Voice
                </a>
            </div>
        `;
    }
}

// Initialize Echo Bot when DOM is ready
document.addEventListener('DOMContentLoaded', initEchoBot);