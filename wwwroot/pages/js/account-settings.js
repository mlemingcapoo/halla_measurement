let selectedUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize page
    await loadUsers();
    setupEventListeners();
});

async function loadUsers() {
    try {
        const users = await UserService.getAllUsers();
        const $accountsList = document.getElementById('accounts-list');
        $accountsList.innerHTML = '';

        users.forEach(user => {
            const userElement = createUserListItem(user);
            $accountsList.appendChild(userElement);
        });
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function createUserListItem(user) {
    const div = document.createElement('div');
    div.className = `list-item border rounded-lg p-4 cursor-pointer transition-all duration-200 
        ${selectedUserId === user.UserId ? 'border-orange-500 border-2 translate-x-5 bg-orange-50' : ''}`;
    
    div.addEventListener('mouseenter', () => {
        if (selectedUserId !== user.UserId) {
            div.classList.add('translate-x-2', 'bg-gray-50');
        }
    });

    div.addEventListener('mouseleave', () => {
        if (selectedUserId !== user.UserId) {
            div.classList.remove('translate-x-2', 'bg-gray-50');
        }
    });

    div.addEventListener('click', async (e) => {
        if (e.target.closest('button')) {
            return;
        }

        const previousSelected = document.querySelector('.list-item.border-orange-500');
        if (previousSelected) {
            previousSelected.classList.remove('border-orange-500', 'border-2', 'translate-x-5', 'bg-orange-50');
        }

        div.classList.add('border-orange-500', 'border-2', 'translate-x-5', 'bg-orange-50');
        selectedUserId = user.UserId;

        await showUserHistory(user.UserId, user.Username);
    });

    div.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <h4 class="font-bold text-black">${user.Username}</h4>
                <p class="text-sm text-black">${user.FullName}</p>
                <p class="text-sm text-gray-500">Role: ${user.RoleType}</p>
                <p class="text-sm ${user.IsActive ? 'text-green-600' : 'text-red-600'}">
                    ${user.IsActive ? 'Active' : 'Inactive'}
                </p>
            </div>
            <div class="flex space-x-2">
                <button onclick="editUser(${user.UserId})" 
                        class="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors"
                        title="Edit User">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
                <button onclick="deleteUserWithConfirm(${user.UserId})" 
                        class="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors"
                        title="Delete User">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
    `;
    return div;
}

function setupEventListeners() {
    // New account button
    document.getElementById('new-account-btn').addEventListener('click', () => {
        showAccountModal('create');
    });

    // Account form submission
    document.getElementById('account-form').addEventListener('submit', handleAccountSubmit);

    // Search functionality
    document.getElementById('account-search').addEventListener('input', handleSearch);
}

function showAccountModal(mode, userId = null) {
    const modal = document.getElementById('account-modal');
    const form = document.getElementById('account-form');
    const title = document.getElementById('account-form-title');

    form.reset();
    selectedUserId = userId;

    if (mode === 'edit') {
        title.textContent = 'Edit Account';
        // Load user data into form
        loadUserForEdit(userId);
    } else {
        title.textContent = 'Create New Account';
    }

    modal.classList.remove('hidden');
}

async function loadUserForEdit(userId) {
    try {
        const users = await UserService.getAllUsers();
        const user = users.find(u => u.UserId === userId);
        if (!user) throw new Error('User not found');

        const form = document.getElementById('account-form');
        form.querySelector('[name="username"]').value = user.Username;
        form.querySelector('[name="fullName"]').value = user.FullName;
        form.querySelector('[name="roleType"]').value = user.RoleType;
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleAccountSubmit(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const userData = {
            Username: formData.get('username'),
            FullName: formData.get('fullName'),
            RoleType: formData.get('roleType'),
            IsActive: formData.get('isActive') === 'on',
            Password: formData.get('password')
        };

        if (selectedUserId) {
            userData.UserId = selectedUserId;
            if (!userData.Password) {
                delete userData.Password;
            }
            await UserService.updateUser(userData);
            showToast('Account updated successfully');
        } else {
            if (!userData.Password) {
                throw new Error('Password is required for new accounts');
            }
            await UserService.createUser(userData);
            showToast('Account created successfully');
        }

        closeAccountModal();
        await loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteUserWithConfirm(userId) {
    const result = await PopupUtil.showConfirm({
        title: 'Delete Account',
        message: 'Are you sure you want to delete this account?',
        type: 'danger',
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel'
    });

    if (result) {
        try {
            await UserService.deleteUser(userId);
            showToast('Account deleted successfully');
            await loadUsers();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const accountItems = document.querySelectorAll('#accounts-list .list-item');

    accountItems.forEach(item => {
        const username = item.querySelector('h4').textContent.toLowerCase();
        const fullName = item.querySelector('p').textContent.toLowerCase();
        const isVisible = username.includes(searchTerm) || fullName.includes(searchTerm);
        item.style.display = isVisible ? 'block' : 'none';
    });
}

function closeAccountModal() {
    document.getElementById('account-modal').classList.add('hidden');
    document.getElementById('account-form').reset();
    selectedUserId = null;
}

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

async function editUser(userId) {
    try {
        const users = await UserService.getAllUsers();
        const user = users.find(u => u.UserId === userId);
        if (!user) throw new Error('User not found');

        showAccountModal('edit', userId);

        const form = document.getElementById('account-form');
        form.querySelector('[name="username"]').value = user.Username;
        form.querySelector('[name="fullName"]').value = user.FullName;
        form.querySelector('[name="roleType"]').value = user.RoleType;
        form.querySelector('[name="isActive"]').checked = user.IsActive;

        form.querySelector('[name="password"]').value = '';
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function showUserHistory(userId, username) {
    console.log('🔍 Showing history for user:', { userId, username });
    try {
        console.log('📡 Requesting action history...');
        const history = await ActionHistoryService.getHistoryByUser(userId);
        console.log('📥 Received history data:', history);

        const rightPanel = document.querySelector('.right-panel');
        console.log('🎯 Updating right panel content');
        
        rightPanel.innerHTML = `
            <div class="p-4">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">Action History for ${username}</h2>
                <div id="history-list" class="space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
                    ${history.length === 0 ? 
                        '<p class="text-gray-500 text-center">No actions recorded</p>' : 
                        ''}
                </div>
            </div>
        `;

        const historyList = document.getElementById('history-list');
        console.log('📝 Creating history list items...');
        history.forEach((action, index) => {
            console.log(`🔄 Processing action ${index + 1}/${history.length}:`, action);
            historyList.appendChild(ActionHistoryService.createHistoryListItem(action));
        });
        console.log('✅ History display complete');
    } catch (error) {
        console.error('❌ Error showing user history:', error);
        showToast(error.message, 'error');
    }
}
