import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const LogoutConfirmationModal: React.FC<LogoutConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
          >
            <h2 className="mb-4 text-xl font-semibold">Confirm Logout</h2>
            <p className="mb-6 text-gray-600">Are you sure you want to log out of Nexora Jobs?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={onCancel}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
