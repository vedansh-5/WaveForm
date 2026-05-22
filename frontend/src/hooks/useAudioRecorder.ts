import { useEffect, useRef, useState } from "react";

export const useAudioRecorder = (maxSeconds = 30) => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string>('');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, [audioUrl]);

    const startRecording = async () => {
        try {
            setAudioBlob(null);
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
                setAudioUrl('');
            }
            audioChunksRef.current = [];
            setRecordingTime(0);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm',
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                try {
                    // Convert WebM container to standard 16-bit PCM WAV
                    const wavBlob = await convertWebmToWav(webmBlob);
                    const url = URL.createObjectURL(wavBlob);
                    setAudioBlob(wavBlob);
                    setAudioUrl(url);
                } catch (err) {
                    console.error("Audio conversion failed:", err);
                    alert("Failed to process microphone audio format.");
                }

                // Turn off microphone tracks
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start(250);
            setIsRecording(true);

            const startTime = Date.now();
            timerIntervalRef.current = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed >= maxSeconds) {
                    setRecordingTime(maxSeconds);
                    stopRecording();
                } else {
                    setRecordingTime(elapsed);
                }
            }, 50);
        } catch (err) {
            console.error('Failed to initialize microphone stream access:', err);
            alert('Could not open microphone. Please check system permissions.');
        }
    };

    const stopRecording = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const reset = () => {
        setRecordingTime(0);
        setAudioBlob(null);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl('');
        }
    };

    return {
        isRecording,
        recordingTime,
        audioBlob,
        audioUrl,
        startRecording,
        stopRecording,
        reset,
    };
};

// ==========================================
// 🛠️ WAV PCM 16-bit Mono Encoder Helpers
// ==========================================
async function convertWebmToWav(webmBlob: Blob): Promise<Blob> {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await webmBlob.arrayBuffer();

    // Decode WebM audio to raw channel float values
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0); // Extract Mono (Channel 0)

    return encodeWAV(channelData, audioBuffer.sampleRate);
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* File length */
    view.setUint32(4, 36 + samples.length * 2, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* Format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* Format chunk length */
    view.setUint32(16, 16, true);
    /* Sample format (1 = raw PCM) */
    view.setUint16(20, 1, true);
    /* Channel count (1 = mono) */
    view.setUint16(22, 1, true);
    /* Sample rate */
    view.setUint32(24, sampleRate, true);
    /* Byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 2, true);
    /* Block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* Bits per sample */
    view.setUint16(34, 16, true);
    /* Data chunk identifier */
    writeString(view, 36, 'data');
    /* Data chunk length */
    view.setUint32(40, samples.length * 2, true);

    // Write samples as 16-bit signed PCM integers
    floatTo16BitPCM(view, 44, samples);

    return new Blob([view], { type: 'audio/wav' });
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
