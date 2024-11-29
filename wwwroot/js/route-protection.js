class RouteProtection {
    static async requireAuth(destination, requiredRoles = null) {
        console.log('🔒 Checking auth requirements:', { destination, requiredRoles });
        
        if (!AuthService.isAuthenticated()) {
            console.log('❌ Not authenticated');
            LoginHandler.showLoginModal(destination);
            return false;
        }

        if (requiredRoles) {
            const currentUser = AuthService.getCurrentUser();
            console.log('👤 Current user role:', currentUser?.RoleType);
            
            if (!currentUser || !requiredRoles.includes(currentUser.RoleType)) {
                console.log('🚫 Insufficient permissions');
                showToast('You do not have permission to access this page', 'error');
                return false;
            }
        }

        console.log('✅ Auth check passed');
        return true;
    }

    static setupProtectedLinks() {
        console.log('🔒 Setting up protected links...');

        // Protect Settings button with role requirements
        const settingsBtn = document.querySelector('button[onclick*="settings.html"]');
        if (settingsBtn) {
            console.log('🔒 Found settings button, adding protection');
            settingsBtn.onclick = async (e) => {
                e.preventDefault();
                if (await RouteProtection.requireAuth('./pages/settings.html', ['Admin', 'Staff'])) {
                    window.location.href = './pages/settings.html';
                }
            };
        }

        // Protect Start Measurement button
        const measurementBtn = document.querySelector('button[data-modal="measurement"]');
        if (measurementBtn) {
            console.log('🔒 Found measurement button, adding protection');
            const originalOnClick = measurementBtn.onclick;
            measurementBtn.onclick = async (e) => {
                e.preventDefault();
                if (await RouteProtection.requireAuth()) {
                    if (originalOnClick) {
                        originalOnClick.call(measurementBtn, e);
                    } else {
                        const modal = document.getElementById('measurement-modal');
                        if (modal) modal.classList.remove('hidden');
                    }
                }
            };
        }

        console.log('✅ Protected links setup complete');
    }

    static updateButtonStates() {
        console.log('🔄 Updating protected button states');
        const isAuthenticated = AuthService.isAuthenticated();
        const currentUser = AuthService.getCurrentUser();
        
        // Update settings button state
        const settingsBtn = document.querySelector('button[onclick*="settings.html"]');
        if (settingsBtn) {
            const hasSettingsAccess = isAuthenticated && 
                currentUser && 
                ['Admin', 'Staff'].includes(currentUser.RoleType);

            if (!hasSettingsAccess) {
                settingsBtn.classList.add('opacity-50', 'cursor-not-allowed');
                settingsBtn.title = isAuthenticated ? 
                    'Insufficient permissions' : 
                    'Please login to access settings';
            } else {
                settingsBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                settingsBtn.title = 'Settings';
            }
        }
        
        // Update measurement button state
        const measurementBtn = document.querySelector('button[data-modal="measurement"]');
        if (measurementBtn) {
            if (!isAuthenticated) {
                measurementBtn.classList.add('opacity-50', 'cursor-not-allowed');
                measurementBtn.title = 'Please login to start measurement';
            } else {
                measurementBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                measurementBtn.title = 'Start Measurement';
            }
        }
    }
}

// Initialize route protection when document is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing route protection');
    RouteProtection.setupProtectedLinks();
    RouteProtection.updateButtonStates();
});

// Update button states when auth state changes
document.addEventListener('authStateChanged', () => {
    console.log('👤 Auth state changed, updating button states');
    RouteProtection.updateButtonStates();
});

// Helper function for toasts
function showToast(message, type = 'success') {
    const $container = $('#toast-container');
    const $toast = $(`
        <div class="flex items-center p-4 mb-4 rounded-lg shadow-lg transition-all duration-500 transform translate-x-full
            ${type === 'success' ? 'text-green-800 bg-green-50' : 'text-red-800 bg-red-50'}">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                ${type === 'success' 
                    ? '<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>'
                    : '<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>'}
            </svg>
            <span class="text-sm font-semibold">${message}</span>
        </div>
    `);

    $container.append($toast);
    setTimeout(() => $toast.removeClass('translate-x-full'), 10);
    setTimeout(() => {
        $toast.addClass('translate-x-full');
        setTimeout(() => $toast.remove(), 500);
    }, 3000);
} 