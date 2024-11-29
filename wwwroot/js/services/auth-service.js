class AuthService {
    static async login(username, password) {
        try {
            console.log('Sending login request:', { username, password });
            
            const loginPromise = new Promise((resolve, reject) => {
                window.electronAPI.receive('auth:login-response', (result) => {
                    console.log('Received login response:', result);
                    try {
                        const jsonStr = Array.isArray(result) ? result[0] : result;
                        const response = JSON.parse(jsonStr);
                        console.log('Parsed login response:', response);
                        resolve(response);
                    } catch (error) {
                        console.error('Error parsing login response:', error);
                        reject(error);
                    }
                });

                window.electronAPI.send('auth:login', JSON.stringify({ username, password }));
            });

            const response = await loginPromise;
            console.log('Processing login response:', response);

            if (response.Success) {
                console.log('Login successful, storing user data');
                localStorage.setItem('user', JSON.stringify(response.User));
                localStorage.setItem('token', response.Token);
                this.updateUserDisplay();
                this.dispatchAuthStateChanged();
            } else {
                console.log('Login failed:', response.Message);
            }
            return response;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    static logout() {
        try {
            // Clear the local storage
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            
            // Update the UI
            this.updateUserDisplay();
            
            // Reload the current page instead of redirecting
            window.location.reload();
            
            // Show a toast message
            showToast('Đã đăng xuất thành công');
            this.dispatchAuthStateChanged();
        } catch (error) {
            console.error('Logout error:', error);
            showToast('Có lỗi khi đăng xuất', 'error');
        }
    }

    static isAuthenticated() {
        return !!localStorage.getItem('token');
    }

    static getCurrentUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }

    static getToken() {
        return localStorage.getItem('token');
    }

    static updateUserDisplay() {
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        const userRole = document.getElementById('userRole');

        const user = this.getCurrentUser();
        
        if (user && this.isAuthenticated()) {
            userInfo.classList.remove('hidden');
            userName.textContent = user.FullName;
            userRole.textContent = user.RoleType;
        } else {
            userInfo.classList.add('hidden');
            userName.textContent = '';
            userRole.textContent = '';
        }
    }

    static dispatchAuthStateChanged() {
        console.log('📢 Dispatching auth state changed event');
        document.dispatchEvent(new Event('authStateChanged'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    AuthService.updateUserDisplay();
}); 