$(document).ready(function() {
    console.log("DBConfig loaded");
    // prevent default form submit
    $('#dbConfigForm').submit(function(event) {
        event.preventDefault();
    });
    loadConfig();

    // button event
    $('#saveConfig').click(function() {
        saveConfig();
    });
    $('#testConnection').click(function() {
        testConnection();
    });
});

function loadConfig() {
    console.log("Loading config");

    window.electronAPI.receiveOnce("dbconfig:get-response", (arg) => {
        console.log("Config loaded", arg);
        const config = JSON.parse(arg);
        if (config.success) {
            console.log(config.config);
            // response: 
            // {
            //     "DatabaseConfig": {
            //       "Server": "localhost",
            //       "Database": "HallaMeasurements",
            //       "Username": "sa",
            //       "Password": "17012004Trung@",
            //       "IntegratedSecurity": false,
            //       "TrustServerCertificate": true,
            //       "CommandTimeout": 30
            //     }
            //   }
            fillConfig(config.config);
        } else {
            console.error("Failed to load config", config.message);
        }
    });
    window.electronAPI.send("dbconfig:get");
}

function fillConfig(config) {
    // Parse the config JSON string if needed
    if (typeof config === 'string') {
        config = JSON.parse(config);
    }

    // Get the DatabaseConfig object
    const dbConfig = config.DatabaseConfig;

    if (!dbConfig) {
        console.warn('No database configuration found');
        return;
    }

    // Fill in form fields with config values
    $('#server').val(dbConfig.Server || '');
    $('#database').val(dbConfig.Database || '');
    $('#username').val(dbConfig.Username || '');
    $('#password').val(dbConfig.Password || '');
    $('#commandTimeout').val(dbConfig.CommandTimeout || 30);
    $('#integratedSecurity').prop('checked', dbConfig.IntegratedSecurity || false);
    $('#trustServerCertificate').prop('checked', dbConfig.TrustServerCertificate || false);

    console.log('Database configuration loaded:', dbConfig);
}

function saveConfig() {
    console.log("Testing connection before saving");
    
    // Show loading state
    $('#testConnection').prop('disabled', true);
    $('#testConnection').html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Testing...');

    // Get current config and send test request
    window.electronAPI.receiveOnce("dbconfig:test-response", (response) => {
        const result = JSON.parse(response);
        
        if (result.success) {
            // Test successful, proceed with saving
            console.log("Saving config");
            window.electronAPI.receiveOnce("dbconfig:update-response", (arg) => {
                console.log("Config saved", arg);
                showToast('Connection successful and config saved!', 'success', 9999999);
                showToast('Cần đóng app và mở lại để áp dụng config mới!', 'info', 9999999);
            });
            window.electronAPI.send("dbconfig:update", JSON.stringify(getConfig()));
        } else {
            // Show error message
            showToast(`Connection failed: ${result.message}. Config not saved.`, 'error');
        }

        // Reset button state
        $('#testConnection').prop('disabled', false);
        $('#testConnection').text('Test Connection');
    });

    window.electronAPI.send("dbconfig:test", JSON.stringify(getConfig()));
}

function getConfig() {
    return {
        Server: $('#server').val(),
        Database: $('#database').val(),
        Username: $('#username').val(),
        Password: $('#password').val(),
        CommandTimeout: parseInt($('#commandTimeout').val()) || 30,
        IntegratedSecurity: $('#integratedSecurity').prop('checked'),
        TrustServerCertificate: $('#trustServerCertificate').prop('checked')
    }
}

function testConnection() {
    console.log("Testing connection");
    
    // Show loading state
    $('#testConnection').prop('disabled', true);
    $('#testConnection').html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Testing...');

    // Get current config and send test request
    window.electronAPI.receiveOnce("dbconfig:test-response", (response) => {
        const result = JSON.parse(response);
        
        if (result.success) {
            // Show success message
            showToast('Connection successful!', 'success');
        } else {
            // Show error message
            showToast(`Connection failed: ${result.message}`, 'error');
        }

        // Reset button state
        $('#testConnection').prop('disabled', false);
        $('#testConnection').text('Test Connection');
    });

    window.electronAPI.send("dbconfig:test", JSON.stringify(getConfig()));
}


