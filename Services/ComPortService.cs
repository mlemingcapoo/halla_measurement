using System;
using System.IO.Ports;
using System.Text;
using Services;
using System.Management;
using System.Runtime.Versioning;

namespace Services
{
    public class ComPortService
    {
        private StringBuilder _dataBuffer = new StringBuilder();
        private const string MESSAGE_TERMINATOR = "\r"; // Terminator 0Dh 1 CR(Carriage return)
        private readonly ILogger<ComPortService> _logger;
        private SerialPort? _connectedPort;
        private string _lastCommand = string.Empty;
        private const int RESPONSE_TIMEOUT_MS = 1100;
        private TaskCompletionSource<string>? _currentResponseTask;
        public event EventHandler<string>? CommandError;

        // Different events for different response types
        public event EventHandler<string>? ReceiverStatusReceived;
        public event EventHandler<string>? MeasurementDataReceived;
        public event EventHandler<string>? GenericDataReceived;
        public event EventHandler<string>? TransmitterInfoReceived;
        // private const string GET_RECEIVER_INFO_COMMAND = "IR1000000\r";
        // private const string GET_MEASUREMENT_DATA_COMMAND = "DR1FF0010\r";

        public ComPortService(ILogger<ComPortService> logger)
        {
            _logger = logger;
        }

        // doc: IR[destinationDevice][channel][groupId][method]
        private string GET_DEVICE_INFO_COMMAND(string destinationDevice, string channel, string groupId, string method)
        {
            return $"IR1{destinationDevice}{channel}{groupId}{method}\r";
        }

        // event driven mode only
        private string GET_MEASUREMENT_DATA_COMMAND(string channel, string groupId, string willClear, string method)
        {
            return $"DR1{channel}{groupId}{willClear}{method}\r";
        }

        private string GET_RECEIVER_INFO_COMMAND(string channel, string groupId)
        {
            return GET_DEVICE_INFO_COMMAND("0", channel, groupId, "0");
        }

        private string GET_TRANSMITTER_INFO_COMMAND(string channel, string groupId, string method)
        {
            return GET_DEVICE_INFO_COMMAND("1", channel, groupId, method);
        }

        public string[] GetAvailablePorts()
        {
            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_PnPEntity WHERE ClassGuid=\"{4d36e978-e325-11ce-bfc1-08002be10318}\""))
                {
                    return searcher.Get()
                        .Cast<ManagementObject>()
                        .Select(p => p["Caption"]?.ToString() ?? "")
                        .Where(n => n != null &&
                            n.Contains("(COM") &&
                            n.Contains("Mitutoyo", StringComparison.OrdinalIgnoreCase) &&
                            !n.Contains("Virtual", StringComparison.OrdinalIgnoreCase))
                        .Select(s => s.Substring(s.LastIndexOf("(COM")).Trim('(', ')'))
                        .ToArray();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting available serial ports: {ex.Message}");
                return Array.Empty<string>();
            }
        }

        public SerialPort? GetConnectedPort()
        {
            return _connectedPort;
        }

        public bool IsPortAvailable(string portName)
        {
            try
            {
                var availablePorts = GetAvailablePorts();
                if (availablePorts.Contains(portName))
                {
                    return true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error checking if port is available: {ex.Message}");
            }
            return false;
        }

        public string[] GetPortsByName(string portName)
        {
            // todo: implement this
            return new string[] { portName };
        }

        public bool IsConnected()
        {
            return _connectedPort != null && _connectedPort.IsOpen;
        }

        public async Task DisconnectAsync()
        {
            _logger.LogInformation("Disconnecting COM port");
            if (_connectedPort != null)
            {
                if (_connectedPort.IsOpen)
                {
                    // Remove the event handler when disconnecting
                    _connectedPort.DataReceived -= SerialPortDataReceived;
                    await Task.Run(() => _connectedPort.Close());
                    _logger.LogInformation("COM port closed");
                }
                await Task.Run(() => _connectedPort.Dispose());
                _connectedPort = null;
                _logger.LogInformation("COM port disposed");
            }
        }

        // public void SendReceiverStatusRequest()
        // {
        //     // channel 00, group 00
        //     SendCommand(GET_RECEIVER_INFO_COMMAND("00", "00"));
        // }

        // Modify your existing methods to use the new SendCommandWithResponse
        public async Task SendReceiverStatusRequest()
        {
            await SendCommandWithResponse(GET_RECEIVER_INFO_COMMAND("00", "00"));
        }

        public async Task SendCommandWithResponse(string command)
        {
            _logger.LogInformation($"Sending command: {command} to port {_connectedPort?.PortName}");
            if (IsConnected() == false) return;
            try
            {
                _currentResponseTask = new TaskCompletionSource<string>();
                _lastCommand = command;
                _connectedPort?.Write(command);
                _logger.LogInformation($"Command sent!: {command}");
                using var cts = new CancellationTokenSource(RESPONSE_TIMEOUT_MS);
                cts.Token.Register(() => _currentResponseTask.TrySetCanceled());
                try
                {
                    await _currentResponseTask.Task;
                }
                catch (OperationCanceledException)
                {
                    var errorMessage = $"No response received for command {command} after {RESPONSE_TIMEOUT_MS}ms";
                    _logger.LogError(errorMessage);
                    CommandError?.Invoke(this, errorMessage);
                }
            }
            catch (Exception ex)
            {
                var errorMessage = $"Error sending command {command}: {ex.Message}";
                _logger.LogError(errorMessage);
                CommandError?.Invoke(this, errorMessage);
            }
            finally
            {
                _lastCommand = string.Empty;
                _currentResponseTask = null;
            }
        }

        public string ReadResponse()
        {
            _logger.LogInformation($"Reading response from port {_connectedPort?.PortName}");
            return _connectedPort?.ReadLine() ?? "";
        }

        public string GetCurrentPortInfo()
        {
            if (_connectedPort == null) return "Chưa kết nối hoặc máy đo không được kết nối?";

            var info = $"Port: {_connectedPort.PortName}\n" +
                   $"Baud-Rate: {_connectedPort.BaudRate}\n" +
                   $"Parity: {_connectedPort.Parity}\n" +
                   $"Data-Bits: {_connectedPort.DataBits}\n" +
                   $"Stop-Bits: {_connectedPort.StopBits}\n" +
                   $"Handshake: {_connectedPort.Handshake}\n" +
                   $"DTR-Enable: {_connectedPort.DtrEnable}\n" +
                   $"RTS-Enable: {_connectedPort.RtsEnable}\n" +
                   $"Open: {_connectedPort.IsOpen}";
            return info.Replace("\n", "<br>");
            // return $"Cổng đang kết nối: {_connectedPort.PortName}";
        }

        public bool ConnectUsingDefaultSettings(string portName)
        {
            return Connect(portName, 57600, Parity.None, 8, StopBits.One);
        }

        public bool ConnectUsingCustomSettings(string portName, int baudRate, Parity parity, int dataBits, StopBits stopBits)
        {
            return Connect(portName, baudRate, parity, dataBits, stopBits);
        }

        public async Task<bool> ConnectUsingDefaultSettingsAsync(string portName)
        {
            await DisconnectAsync();
            return await Task.Run(() => ConnectUsingDefaultSettings(portName));
        }

        public async Task<bool> ConnectAsync(string portName, int baudRate, Parity parity, int dataBits, StopBits stopBits)
        {
            // close the port if it is already open
            await DisconnectAsync();
            return await Task.Run(() => Connect(portName, baudRate, parity, dataBits, stopBits));
        }

        // Add these fields at the class level:
        // private StringBuilder _dataBuffer = new StringBuilder();
        // private const string MESSAGE_TERMINATOR = "M"; // Mitutoyo devices use 'M' as terminator
        // private const string DT_PREFIX = "DT";

        private void SerialPortDataReceived(object sender, SerialDataReceivedEventArgs e)
        {
            SerialPort sp = (SerialPort)sender;
            try
            {
                if (IsConnected() == false) return;
                var data = sp.ReadExisting();
                _logger.LogInformation($"Received RAW data from COM port: {data}");

                // Buffer the incoming data
                _dataBuffer.Append(data);
                string bufferContent = _dataBuffer.ToString();

                // Check if we have a complete message (ending with 'M')
                while (bufferContent.Contains(MESSAGE_TERMINATOR))
                {
                    int terminatorIndex = bufferContent.IndexOf(MESSAGE_TERMINATOR);
                    string completeMessage = bufferContent.Substring(0, terminatorIndex + 1);

                    // Remove processed message from buffer
                    _dataBuffer.Remove(0, terminatorIndex + 1);
                    bufferContent = _dataBuffer.ToString();

                    // Process the complete message
                    ProcessMessage(completeMessage);
                }

                // Complete the response task with raw data for backward compatibility
                _currentResponseTask?.TrySetResult(data);
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error receiving data: {ex.Message}");
                _currentResponseTask?.TrySetException(ex);
            }
        }

        private void ProcessMessage(string message)
        {
            try
            {
                // Handle DT messages that might be split
                if (message.StartsWith("DT"))
                {
                    MeasurementDataReceived?.Invoke(this, message);
                }
                else if (message.StartsWith("RI"))
                {
                    ReceiverStatusReceived?.Invoke(this, message);
                }
                else if (message.StartsWith("TI"))
                {
                    TransmitterInfoReceived?.Invoke(this, message);
                }
                else
                {
                    // If the message doesn't start with DT but ends with M, 
                    // it might be continuation of previous DT message
                    if (_lastCommand.StartsWith("DR") && message.EndsWith("M"))
                    {
                        string reconstructedMessage = $"DT{message}";
                        MeasurementDataReceived?.Invoke(this, reconstructedMessage);
                    }
                    else
                    {
                        GenericDataReceived?.Invoke(this, message);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error processing message: {ex.Message}");
            }
        }

        public bool Connect(string portName, int baudRate, Parity parity, int dataBits, StopBits stopBits)
        {
            try
            {
                _connectedPort = new SerialPort(portName, baudRate, parity, dataBits, stopBits)
                {
                    Handshake = Handshake.None,
                    ReadTimeout = 1000,
                    WriteTimeout = 1000,
                    DtrEnable = true, // Set to High
                    RtsEnable = true  // Set to High
                };
                _connectedPort.DataReceived += SerialPortDataReceived;
                _connectedPort.Open();
                _logger.LogInformation("Connected to port " + portName);
            }
            catch (UnauthorizedAccessException e)
            {
                _logger.LogError($"Access denied to port {portName}. The port may be in use: {e.Message}");
                CommandError?.Invoke(this, $"Không thể truy cập vào cổng {portName}. Cổng có thể đang được sử dụng bởi một chương trình khác.");
                return false;
            }
            catch (ArgumentException e)
            {
                _logger.LogError($"Invalid port name or configuration for {portName}: {e.Message}");
                return false;
            }
            catch (IOException e)
            {
                _logger.LogError($"IO error accessing port {portName}. The port may be unavailable: {e.Message}");
                CommandError?.Invoke(this, $"Thiết bị đo không phản hồi mặc dù đã kết nối. Vui lòng kiểm tra lại cáp!");
                return false;
            }
            catch (Exception e)
            {
                _logger.LogError($"Unexpected error connecting to port {portName}: {e.Message}");
                return false;
            }
            return true;
        }

        public string GetCurrentPortName()
        {
            return _connectedPort?.PortName ?? "";
        }

    }
}

