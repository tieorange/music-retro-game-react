import { useState, useRef, DragEvent } from 'react';
import { motion } from 'framer-motion';
import { FileAudio } from 'lucide-react';

interface DropZoneProps {
    onFileAccepted: (file: File) => void;
}

export function DropZone({ onFileAccepted }: DropZoneProps) {
    const [isDragActive, setIsDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('audio/')) {
                onFileAccepted(file);
            }
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.type.startsWith('audio/')) {
                onFileAccepted(file);
            }
        }
    };

    return (
        <motion.div
            className={`relative w-full max-w-xl p-6 sm:p-12 text-center border-4 border-dashed cursor-pointer bg-slate-900/50 backdrop-blur-sm transition-colors duration-300 ${isDragActive ? 'border-neon-cyan shadow-[0_0_30px_rgba(0,255,255,0.3)]' : 'border-slate-700 hover:border-neon-magenta hover:shadow-[0_0_20px_rgba(255,0,255,0.2)]'}`}
            onClick={handleClick}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*"
                className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-6 pointer-events-none">
                <motion.div
                    animate={{ y: isDragActive ? -10 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                    <FileAudio size={40} className={`sm:w-16 sm:h-16 ${isDragActive ? "text-neon-cyan" : "text-slate-400"}`} />
                </motion.div>

                <div className="space-y-2 text-shadow-sm font-bold">
                    <p className={`text-base sm:text-xl md:text-2xl ${isDragActive ? 'text-neon-cyan' : 'text-white'}`}>
                        {isDragActive ? 'DROP IT!' : 'TAP TO PICK A TRACK'}
                    </p>
                    <p className="text-sm text-slate-400">
                        or click to browse files
                    </p>
                </div>

                <p className="text-xs text-slate-500 pt-4">
                    Supported: MP3, WAV, OGG, M4A
                </p>
            </div>
        </motion.div>
    );
}
