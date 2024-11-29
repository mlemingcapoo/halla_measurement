class LoginHandler {
    static async init() {
        try {
            const response = await fetch('./modals/login-modal.html');
            const modalHtml = await response.text();
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', this.handleLogin.bind(this));
            } else {
                console.error('Login form not found after modal initialization');
            }
        } catch (error) {
            console.error('Failed to load login modal:', error);
            throw error;
        }
    }

    static async handleLogin(event) {
        event.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await AuthService.login(username, password);
            console.log('Login response in handler:', response);

            if (response.Success) {
                closeLoginModal();
            } else {
                showToast(response.Message || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error in handler:', error);
            showToast('Login failed: ' + error.message, 'error');
        }
    }

    static showLoginModal() {
        document.getElementById('login-modal').classList.remove('hidden');
    }
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.add('hidden');
}

// Initialize login handler when document is ready
document.addEventListener('DOMContentLoaded', () => {
    LoginHandler.init().catch(error => {
        console.error('Failed to initialize login handler:', error);
    });
}); 