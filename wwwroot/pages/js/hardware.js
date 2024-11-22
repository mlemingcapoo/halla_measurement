$(document).ready(function () {

    setInterval(function () {
        getAvailablePorts();
    }, 5000);
    getAvailablePorts();

    // todo: implement a button to manually refresh the current serial port list
    setTimeout(function () {
        getCurrentSerialPort();
        // getCurrentSerialPort();
    }, 100);

    $('#btn-get-available-ports').click(async function () {
        getAvailablePorts();
    });

    $('#select-serial-port').change(function () {
        connectToSerialPort();
    });

    $('#btn-close-port').click(function () {
        closePort();
    });

    function closePort() {
        window.electronAPI.send('close-serial-port');
        // showToast('Đã ngắt kết nối cổng COM...', 'info');
    }

    function connectToSerialPort() {
        // const selectedPort = $('#select-serial-port').val();
        // console.log('Selected port:', selectedPort);
        // window.electronAPI.send('connect-to-serial-port', selectedPort);
        localStorage.setItem('selected-serial-port', $('#select-serial-port').val());
        const selectedPort = localStorage.getItem('selected-serial-port');
        $('#current-serial-port-name').text(selectedPort == "" ? "CHƯA CHỌN" : selectedPort);
        showToast('Đã chọn cổng: ' + $('#select-serial-port').val(), 'success');
    }

    function getCurrentSerialPort() {
        const selectedPort = localStorage.getItem('selected-serial-port');
        $('#current-serial-port-name').text(selectedPort == "" ? "CHƯA CHỌN" : selectedPort);
        // window.electronAPI.receive('current-serial-port', (result) => {
        //     $('#current-serial-port-name').text(result == "" ? "NOT CONNECTED" : result);
        // });
        // window.electronAPI.send('get-current-serial-port');
    }

    function getAvailablePorts() {
        window.electronAPI.receive('available-serial-ports', (result) => {
            console.log(result);
            $('#select-serial-port').empty();
            $('#select-serial-port').append('<option value="">Danh sách cổng COM máy đo (Chọn để đổi cổng)</option>');
            result.forEach(port => {
                $('#select-serial-port').append('<option value="' + port + '">' + port + '</option>');
            });
        });

        window.electronAPI.send('get-available-serial-ports');
    }

    function autoSearchAndConnect() {
        // todo: implement this
    }

    async function checkReceiver() {
        window.electronAPI.receive('receiver-status-received', (result) => {
            PopupUtil.showAlert({
                title: 'Kết quả kiểm tra kết nối tới bộ nhận tín hiệu',
                message: result,
                type: 'info'
            });
        });
        // show toast message
        showToast('Đang kiểm tra kết nối tới bộ nhận tín hiệu...', 'info', 5000);
        await quickConnect();
        window.electronAPI.send('check-receiver-info');
        // await quickDisconnect();
    }

    async function quickConnect() {
        // await new Promise(resolve => setTimeout(resolve, 500));
        const selectedPort = localStorage.getItem('selected-serial-port');
        console.log('Selected port:', selectedPort);
        window.electronAPI.send('connect-to-serial-port', selectedPort);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    async function quickDisconnect() {
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.electronAPI.send('close-serial-port');
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    async function getComPortInfo() {
        // Set up the receiver first
        window.electronAPI.receive('current-serial-port-info', (result) => {
            console.log('Received: ' + result);
            PopupUtil.showAlert({
                title: 'Chi tiết cổng COM đã chọn',
                message: result,
                type: 'info'
            });
        });

        showToast('Đang lấy thông tin cổng COM, vui lòng đợi...', 'info', 5000);

        await quickConnect();
        window.electronAPI.send('get-current-serial-port-info');
        console.log('Sending...');
        // await quickDisconnect();

        // await PopupUtil.showAlert({
        //     title: 'Getting info',
        //     message: 'Please wait...',
        //     type: 'info'
        // });

        // await PopupUtil.showConfirm({
        //     title: 'Are you sure?',
        //     message: 'This action cannot be undone.',
        //     type: 'warning'
        // });
    }

    $('#btn-check-receiver').click(async function () {
        // disable button
        $('#btn-get-com-port-info').prop('disabled', true);
        $('#btn-check-receiver').prop('disabled', true);
        await checkReceiver();
        // enable button
        $('#btn-get-com-port-info').prop('disabled', false);
        $('#btn-check-receiver').prop('disabled', false);
    });
    
    $('#btn-get-com-port-info').click(async function () {
        $('#btn-get-com-port-info').prop('disabled', true);
        $('#btn-check-receiver').prop('disabled', true);
        // disable button
        await getComPortInfo();
        // enable button
        $('#btn-get-com-port-info').prop('disabled', false);
        $('#btn-check-receiver').prop('disabled', false);
    });

    // $('#btn-set-serial-port').click(function () {
    //     const serialPort = $('#input-serial-port').val();
    //     window.electronAPI.send('set-current-serial-port', serialPort);
    // });

    // Initialize clock
    function updateClock() {
        const now = new Date();
        $('#clock').text(now.toLocaleTimeString());
        $('#date').text(now.toLocaleDateString());
    }
    updateClock();
    setInterval(updateClock, 1000);

});

window.electronAPI.receive('command-error', (errorMessage) => {
    console.error('Command error:', errorMessage);
    showToast(errorMessage, 'error', 10000);
});

window.electronAPI.receive('command-success', (successMessage) => {
    console.log('Command success:', successMessage);
    showToast(successMessage, 'success', 3000);
});

window.electronAPI.receive('status-received', (statusMessage) => {
    console.log('Status received:', statusMessage);
    showToast(statusMessage, 'info', 10000);
});

// window.electronAPI.receive('receiver-status-received', (statusMessage) => {
//     console.log('Receiver status received:', statusMessage);
//     showToast(statusMessage, 'info', 10000);
// });

// window.electronAPI.receive('transmitter-status-received', (statusMessage) => {
//     console.log('Transmitter status received:', statusMessage);
//     showToast(statusMessage, 'info', 10000);
// });
