import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<Props> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Bestätigen',
    cancelText = 'Abbrechen',
    type = 'warning'
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="relative z-[2001] bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className={`p-2 rounded-full ${type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                    </div>
                    <p className="text-slate-600 mb-6 leading-relaxed">
                        {message}
                    </p>
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`px-4 py-2 text-white rounded-lg font-bold shadow-sm transition-colors ${type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
