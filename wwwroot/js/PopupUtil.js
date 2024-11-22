(() => {
    if (!document.getElementById('popup-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'popup-styles';
        styleSheet.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(1rem);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes slideOut {
                from {
                    opacity: 1;
                    transform: translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateY(1rem);
                }
            }
        `;
        document.head.appendChild(styleSheet);
    }
})();

class PopupUtil {
    static async showAlert(options = {}) {
        const {
            title = 'Alert',
            message = '',
            type = 'info', // success, danger, warning, info
            confirmButtonText = 'OK'
        } = options;

        // Define color schemes based on type
        const colorSchemes = {
            success: 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700 focus:ring-green-500',
            danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 focus:ring-red-500',
            warning: 'bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700 focus:ring-yellow-500',
            info: 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 focus:ring-blue-500'
        };

        const icons = {
            success: '<svg class="w-12 h-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
            danger: '<svg class="w-12 h-12 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
            warning: '<svg class="w-12 h-12 mx-auto text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
            info: '<svg class="w-12 h-12 mx-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
        };

        return new Promise((resolve) => {
            const modalHtml = `
                <div id="customAlert" class="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center">
                    <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity backdrop-blur-sm"></div>
                    
                    <div class="relative z-50 w-full max-w-lg mx-auto p-4">
                        <div style="border-radius: 10px;" class="relative transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all" style="animation: slideIn 0.3s ease-out forwards;">
                            <div class="px-6 pb-6 pt-8 sm:p-8" style="animation: slideIn 0.3s ease-out forwards; padding: 30px 60px 30px 60px;">
                                <div class="text-center">
                                    <div class="w-6 h-6 mx-auto">${icons[type].replace('w-12 h-12', 'w-6 h-6')}</div>
                                    <h3 class="mt-4 text-xl font-bold leading-6 text-gray-900">${title}</h3>
                                    <p class="mt-3 text-gray-600">${message}</p>
                                </div>
                            </div>
                            <div class="bg-gray-50 px-6 py-4 sm:px-8">
                                <div class="sm:flex sm:flex-row-reverse">
                                    <button type="button" class="inline-flex w-full justify-center rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 sm:ml-3 sm:w-auto focus:ring-2 focus:ring-offset-2 ${colorSchemes[type]}">${confirmButtonText}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove any existing modal first
            const existingModal = document.getElementById('customAlert');
            if (existingModal) {
                existingModal.remove();
            }

            // Add new modal
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modalElement = document.getElementById('customAlert');
            const overlay = modalElement.querySelector('.bg-black');
            const confirmButton = modalElement.querySelector('button');

            // Store event handler references
            const handleEscape = (e) => {
                if (e.key === 'Escape') closeModal();
            };

            const closeModal = () => {
                // Remove event listeners
                confirmButton.removeEventListener('click', closeModal);
                overlay.removeEventListener('click', closeModal);
                document.removeEventListener('keydown', handleEscape);

                // Animate and remove
                modalElement.classList.add('closing');
                const transformElement = modalElement.querySelector('.transform');
                if (transformElement) {
                    transformElement.style.animation = 'slideOut 0.2s ease-in forwards';
                }
                
                setTimeout(() => {
                    if (modalElement && modalElement.parentNode) {
                        modalElement.remove();
                    }
                    resolve(true);
                }, 200);
            };

            // Add event listeners
            confirmButton.addEventListener('click', closeModal);
            overlay.addEventListener('click', closeModal);
            document.addEventListener('keydown', handleEscape);
        });
    }

    static async showConfirm(options = {}) {
        const {
            title = 'Confirm',
            message = '',
            type = 'info',
            confirmButtonText = 'Confirm',
            cancelButtonText = 'Cancel'
        } = options;

        const colorSchemes = {
            success: 'bg-green-500 hover:bg-green-600 active:bg-green-700 focus:ring-green-500',
            danger: 'bg-red-500 hover:bg-red-600 active:bg-red-700 focus:ring-red-500',
            warning: 'bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 focus:ring-yellow-500',
            info: 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 focus:ring-blue-500'
        };

        const icons = {
            success: '<svg class="w-12 h-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
            danger: '<svg class="w-12 h-12 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
            warning: '<svg class="w-12 h-12 mx-auto text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
            info: '<svg class="w-12 h-12 mx-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
        };

        return new Promise((resolve) => {
            const modalHtml = `
                <div id="customConfirm" class="fixed inset-0 z-50 overflow-y-auto">
                    <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity backdrop-blur-sm"></div>
                    
                    <div class="flex min-h-full items-center justify-center p-4">
                        <div class="relative transform overflow-hidden bg-white shadow-2xl transition-all sm:w-full sm:max-w-lg rounded-xl" style="animation: slideIn 0.3s ease-out forwards;">
                            <div class="px-6 pb-6 pt-8 sm:p-8 rounded-xl" style="animation: slideIn 0.3s ease-out forwards; padding: 30px 60px 30px 60px;">
                                <div class="text-center">
                                    <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-${type === 'info' ? 'blue' : type === 'success' ? 'green' : type === 'warning' ? 'yellow' : 'red'}-100">
                                        ${icons[type]}
                                    </div>
                                    <h3 class="mt-4 text-xl font-bold leading-6 text-gray-900">${title}</h3>
                                    <p class="mt-3 text-gray-600">${message}</p>
                                </div>
                            </div>
                            <div class="bg-gray-50 px-6 py-4 sm:px-8">
                                <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
                                    <button type="button" data-result="true" class="inline-flex w-full justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-black shadow-sm ring-1 ring-inset transition-all duration-200 sm:w-auto focus:ring-2 focus:ring-offset-2 ${colorSchemes[type]}">${confirmButtonText}</button>
                                    <button type="button" data-result="false" class="inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 sm:w-auto">${cancelButtonText}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modalElement = document.getElementById('customConfirm');
            const overlay = modalElement.querySelector('.bg-black');
            const buttons = modalElement.querySelectorAll('button');

            const closeModal = (result) => {
                modalElement.classList.add('closing');
                modalElement.querySelector('.transform').style.animation = 'slideOut 0.2s ease-in forwards';
                setTimeout(() => {
                    modalElement.remove();
                    resolve(result);
                }, 200);
            };

            buttons.forEach(button => {
                button.addEventListener('click', () => {
                    closeModal(button.dataset.result === 'true');
                });
            });

            overlay.addEventListener('click', () => closeModal(false));
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeModal(false);
            });
        });
    }
}

function showToast(message, type = 'success', timeout = 3000) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        // Increased z-index to be higher than modal overlay
        container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');

    // Base classes for all toast types
    const baseClasses = 'flex items-center justify-between p-4 mb-4 rounded-lg shadow-lg transition-all duration-500 transform translate-x-full';
    
    // Type-specific classes
    let typeClasses;
    switch (type) {
        case 'success':
            typeClasses = 'text-green-800 bg-green-50 dark:bg-gray-800 dark:text-green-400';
            break;
        case 'error':
            typeClasses = 'text-red-800 bg-red-50 dark:bg-gray-800 dark:text-red-400';
            break;
        case 'info':
            typeClasses = 'text-blue-800 bg-blue-50 dark:bg-gray-800 dark:text-blue-400';
            break;
        case 'warning':
            typeClasses = 'text-yellow-800 bg-yellow-50 dark:bg-gray-800 dark:text-yellow-400';
            break;
        default:
            typeClasses = 'text-green-800 bg-green-50 dark:bg-gray-800 dark:text-green-400';
    }

    toast.className = `${baseClasses} ${typeClasses}`;

    // Type-specific icons
    let icon;
    switch (type) {
        case 'success':
            icon = '<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
            break;
        case 'error':
            icon = '<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
            break;
        case 'info':
            icon = '<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>';
            break;
        case 'warning':
            icon = '<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>';
            break;
        default:
            icon = '<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
    }

    toast.innerHTML = `
        <div class="flex items-center">
            ${icon}
            <span class="text-sm font-semibold">${message}</span>
        </div>
        <button class="ml-4 hover:opacity-75 transition-opacity duration-200">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
        </button>
    `;

    container.appendChild(toast);

    // Add click handler for dismiss button
    const dismissButton = toast.querySelector('button');
    dismissButton.addEventListener('click', () => {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            container.removeChild(toast);
        }, 500);
    });

    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 10);

    // Auto remove after timeout unless dismissed
    const timeoutId = setTimeout(() => {
        if (container.contains(toast)) {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 500);
        }
    }, timeout);
}