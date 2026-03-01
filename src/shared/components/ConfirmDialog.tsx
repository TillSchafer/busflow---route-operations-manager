import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import ModalShell from '../ui/dialog/ModalShell';

interface Props {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    confirmButtonClassName?: string;
    cancelButtonClassName?: string;
    isConfirming?: boolean;
}

const ConfirmDialog: React.FC<Props> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Bestätigen',
    cancelText = 'Abbrechen',
    type = 'warning',
    confirmButtonClassName,
    cancelButtonClassName,
    isConfirming = false,
}) => {
    return (
        <ModalShell isOpen={isOpen} className="max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div>
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
                            disabled={isConfirming}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${cancelButtonClassName || 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isConfirming}
                            className={`px-4 py-2 text-white rounded-lg font-bold shadow-sm transition-colors disabled:opacity-70 flex items-center gap-2 ${confirmButtonClassName || (type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700')}`}
                        >
                            {isConfirming && <Loader2 className="w-4 h-4 animate-spin" />}
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </ModalShell>
    );
};

export default ConfirmDialog;
