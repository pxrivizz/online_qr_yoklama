import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { ArrowLeft, Check, X } from 'lucide-react';
import { attendanceAPI } from '../../api/attendanceAPI';
import toast from 'react-hot-toast';

export const QRScanner = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const redirectRef = useRef(null);
  const scanningRef = useRef(true);
  const qrHandlerRef = useRef(null);

  const [, setIsScanning] = useState(true);
  const [scanStatus, setScanStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [courseName, setCourseName] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');

  const stopCamera = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (redirectRef.current) clearTimeout(redirectRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && scanningRef.current) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (width && height) {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
          if (code) {
            scanningRef.current = false;
            setIsScanning(false);
            stopCamera();
            qrHandlerRef.current?.(code.data);
            return;
          }
        }
      }
      if (scanningRef.current) frameRef.current = requestAnimationFrame(tick);
    };

    const startCamera = async () => {
      try {
        if (!window.isSecureContext && location.hostname !== 'localhost') throw new Error('INSECURE_CONTEXT');
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('UNSUPPORTED');
        stopCamera();
        const video = selectedCamera
          ? { deviceId: { exact: selectedCamera }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } };
        const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter((item) => item.kind === 'videoinput');
        setCameras(devices);
        const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (!selectedCamera && activeId) setSelectedCamera(activeId);
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
        scanningRef.current = true;
        setIsScanning(true);
        frameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error('Camera access error:', err);
        const messages = {
          INSECURE_CONTEXT: 'Kamera için uygulamayı HTTPS üzerinden açın.',
          UNSUPPORTED: 'Bu tarayıcı kamera erişimini desteklemiyor.',
          NotAllowedError: 'Kamera izni reddedildi. Tarayıcı ayarlarından izin verin.',
          NotFoundError: 'Kullanılabilir kamera bulunamadı.',
          NotReadableError: 'Kamera başka bir uygulama tarafından kullanılıyor.',
          OverconstrainedError: 'Seçilen kamera kullanılamıyor. Başka bir kamera seçin.',
        };
        const message = messages[err.message] || messages[err.name] || 'Kameraya erişilemedi.';
        toast.error(message);
        setScanStatus('error');
        setErrorMessage(message);
      }
    };
    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [selectedCamera]);

  function handleQRCode(qrToken) {
    setScanStatus('processing');
    if (!navigator.geolocation) {
      setScanStatus('error');
      setErrorMessage('Tarayıcınız konum bilgisini desteklemiyor.');
      autoRedirect();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await attendanceAPI.markAttendance(qrToken, latitude, longitude);
          setScanStatus('success');
          setCourseName(response.data?.course_name || response.course_name || 'Ders');
          toast.success('Yoklamanız başarıyla alındı!');
        } catch (error) {
          setScanStatus('error');
          setErrorMessage(error?.response?.data?.error || 'Yoklama kaydı başarısız oldu.');
          toast.error('Hata oluştu.');
        }
        autoRedirect();
      },
      (geoError) => {
        console.error('Geolocation error:', geoError);
        setScanStatus('error');
        setErrorMessage('Konum bilgisi alınamadı. Lütfen konum izni verin.');
        toast.error('Konum izni gerekiyor.');
        autoRedirect();
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function autoRedirect() { redirectRef.current = setTimeout(() => navigate('/student/dashboard'), 3000); }

  useEffect(() => {
    qrHandlerRef.current = handleQRCode;
  });

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-4 flex items-center z-30 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={() => navigate('/student/dashboard')}
          className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <span className="ml-4 font-bold text-base tracking-tight">QR Tarayıcı</span>
      </header>

      {/* Camera Feed */}
      <div className="flex-1 flex items-center justify-center relative">
        <video ref={videoRef} className="w-full h-full object-cover absolute inset-0" playsInline />

        {/* Scan Overlay */}
        {scanStatus === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="relative w-64 h-64">
              <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-xl" />
              <div className="absolute left-3 right-3 h-0.5 bg-emerald-400/60 top-1/2 -translate-y-1/2 animate-pulse rounded-full" />
            </div>
            <p className="mt-8 text-sm text-center font-medium bg-black/50 backdrop-blur-xl px-5 py-2.5 rounded-xl border border-white/10">
              QR kodu kameraya gösterin
            </p>
          </div>
        )}
        {scanStatus === 'idle' && cameras.length > 1 && (
          <label className="absolute bottom-8 left-4 right-4 z-30 mx-auto max-w-sm rounded-xl bg-black/70 p-3 text-sm">
            Kamera
            <select className="mt-1 w-full rounded-lg bg-white p-2 text-black" value={selectedCamera} onChange={(event) => setSelectedCamera(event.target.value)}>
              {cameras.map((camera, index) => <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Kamera ${index + 1}`}</option>)}
            </select>
          </label>
        )}

        {/* Processing */}
        {scanStatus === 'processing' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center space-y-4 animate-fade-in">
            <div className="animate-spin rounded-full h-14 w-14 border-3 border-white border-t-transparent" />
            <p className="text-base font-medium">Konum alınıyor & yoklama iletiliyor...</p>
          </div>
        )}

        {/* Success */}
        {scanStatus === 'success' && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-700 z-40 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center animate-bounce shadow-2xl mb-6">
              <Check className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold mb-2">Yoklamanız Alındı!</h2>
            {courseName && <p className="text-xl text-emerald-100 font-medium">{courseName}</p>}
            <p className="text-xs text-emerald-200 absolute bottom-8 animate-pulse">Ana sayfaya yönlendiriliyorsunuz...</p>
          </div>
        )}

        {/* Error */}
        {scanStatus === 'error' && (
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500 to-rose-700 z-40 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-6 shadow-2xl animate-shake">
              <X className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold mb-2">Hata Oluştu!</h2>
            <p className="text-lg text-rose-100 font-medium max-w-md">{errorMessage}</p>
            <p className="text-xs text-rose-200 absolute bottom-8 animate-pulse">Ana sayfaya yönlendiriliyorsunuz...</p>
          </div>
        )}
      </div>
    </div>
  );
};
export default QRScanner;
