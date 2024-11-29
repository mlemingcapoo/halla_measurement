class UserService {
    static async getAllUsers() {
        try {
            console.log('👥 Fetching all users...');
            
            const response = await new Promise((resolve) => {
                console.log('📡 Setting up IPC listener for users:getAll-response');
                
                window.electronAPI.receive('users:getAll-response', (result) => {
                    console.log('📥 Received users response:', result);
                    resolve(JSON.parse(result));
                });

                console.log('📤 Sending request for all users...');
                window.electronAPI.send('users:getAll');
            });

            if (!response.success) {
                console.error('❌ Failed to get users:', response.message);
                throw new Error(response.message);
            }

            console.log('✅ Successfully retrieved users:', response.users.length, 'users found');
            return response.users;
        } catch (error) {
            console.error('❌ Error in getAllUsers:', error);
            throw error;
        }
    }

    static async createUser(userData) {
        try {
            console.log('👤 Creating new user:', userData);
            
            const response = await new Promise((resolve) => {
                console.log('📡 Setting up IPC listener for users:create-response');
                
                window.electronAPI.receive('users:create-response', (result) => {
                    console.log('📥 Received create user response:', result);
                    resolve(JSON.parse(result));
                });

                console.log('📤 Sending create user request...');
                window.electronAPI.send('users:create', JSON.stringify(userData));
            });

            if (!response.success) {
                console.error('❌ Failed to create user:', response.message);
                throw new Error(response.message);
            }

            console.log('✅ Successfully created user:', response.user);
            return response.user;
        } catch (error) {
            console.error('❌ Error in createUser:', error);
            throw error;
        }
    }

    static async updateUser(userData) {
        try {
            console.log('🔄 Updating user:', userData);
            
            const response = await new Promise((resolve) => {
                console.log('📡 Setting up IPC listener for users:update-response');
                
                window.electronAPI.receive('users:update-response', (result) => {
                    console.log('📥 Received update user response:', result);
                    resolve(JSON.parse(result));
                });

                console.log('📤 Sending update user request...');
                window.electronAPI.send('users:update', JSON.stringify(userData));
            });

            if (!response.success) {
                console.error('❌ Failed to update user:', response.message);
                throw new Error(response.message);
            }

            console.log('✅ Successfully updated user:', response.user);
            return response.user;
        } catch (error) {
            console.error('❌ Error in updateUser:', error);
            throw error;
        }
    }

    static async deleteUser(userId) {
        try {
            console.log('🗑️ Deleting user:', userId);
            
            const response = await new Promise((resolve) => {
                console.log('📡 Setting up IPC listener for users:delete-response');
                
                window.electronAPI.receive('users:delete-response', (result) => {
                    console.log('📥 Received delete user response:', result);
                    resolve(JSON.parse(result));
                });

                console.log('📤 Sending delete user request...');
                window.electronAPI.send('users:delete', userId.toString());
            });

            if (!response.success) {
                console.error('❌ Failed to delete user:', response.message);
                throw new Error(response.message);
            }

            console.log('✅ Successfully deleted user:', userId);
            return response.userId;
        } catch (error) {
            console.error('❌ Error in deleteUser:', error);
            throw error;
        }
    }
}
