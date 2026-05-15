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

  const [isScanning, setIsScanning] = useState(true);
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [courseName, setCourseName] = useState('');

  useEffect(() => {
    let animationFrameId;
    let streamRef;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        streamRef = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', true); // required to tell iOS safari we don't want fullscreen
          videoRef.current.play();
          animationFrameId = requestAnimationFrame(tick);
        }
      } catch (err) {
        console.error('Camera access error:', err);
        toast.error('Kameraya erişilemedi. Lütfen izin verin.');
        setScanStatus('error');
        setErrorMessage('Kamera erişim izni verilmedi.');
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const video = videoRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && isScanning) {
          setIsScanning(false);
          handleQRCode(code.data);
          return; // Stop the loop
        }
      }
      if (isScanning) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    startCamera();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop());
      }
    };
  }, [isScanning]);

  const handleQRCode = (qrToken) => {
    setScanStatus('processing');
    
    // 1. Get geolocation
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
          // Fallback to showing standard success message if course name isn't returned
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
  };

  const autoRedirect = () => {
    setTimeout(() => {
      navigate('/student/dashboard');
    }, 3000);
  };

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-4 flex items-center z-30 bg-gradient-to-b from-black/70 to-transparent">
        <button 
          onClick={() => navigate('/student/dashboard')} 
          className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <span className="ml-4 font-semibold text-lg">QR Tarayıcı</span>
      </header>

      {/* Camera Feed */}
      <div className="flex-1 flex items-center justify-center relative">
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover absolute inset-0" 
          playsInline
        />

        {/* Scan Overlay */}
        {scanStatus === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="relative w-64 h-64">
              {/* Corner Brackets */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-md" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-md" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-md" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-md" />
              {/* Scanning Beam */}
              <div className="absolute left-2 right-2 h-0.5 bg-green-500/70 top-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <p className="mt-8 text-sm text-center font-medium bg-black/50 backdrop-blur-md px-4 py-2 rounded-full">
              QR kodu kameraya gösterin
            </p>
          </div>
        )}

        {/* Processing State overlay */}
        {scanStatus === 'processing' && (
          <div className="absolute inset-0 bg-black/70 z-20 flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-white border-t-transparent" />
            <p className="text-lg font-medium">Konum alınıyor & yoklama iletiliyor...</p>
          </div>
        )}

        {/* Success Animation Overlay */}
        {scanStatus === 'success' && (
          <div className="absolute inset-0 bg-green-600 z-40 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center animate-bounce shadow-lg mb-6">
              <Check className="w-14 h-14 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold mb-2">Yoklamanız Alındı!</h2>
            {courseName && <p className="text-xl text-green-100 font-medium">{courseName}</p>}
            <p className="text-xs text-green-200 absolute bottom-8 animate-pulse">Ana sayfaya yönlendiriliyorsunuz...</p>
          </div>
        )}

        {/* Error Animation Overlay */}
        {scanStatus === 'error' && (
          <div className="absolute inset-0 bg-red-600 z-40 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 shadow-lg animate-shake">
              <X className="w-14 h-14 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold mb-2">Hata Oluştu!</h2>
            <p className="text-lg text-red-100 font-medium max-w-md">{errorMessage}</p>
            <p className="text-xs text-red-200 absolute bottom-8 animate-pulse">Ana sayfaya yönlendiriliyorsunuz...</p>
          </div>
        )}
      </div>
    </div>
  );
};
export default QRScanner;
