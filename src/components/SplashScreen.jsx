import { LogoMark, Wordmark } from './Logo'

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-[#f5f6f8] flex flex-col items-center justify-center z-50">
      <div className="flex items-center gap-3 mb-8">
        <LogoMark size={44} />
        <Wordmark className="!text-2xl" />
      </div>
      <div className="w-40 h-0.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-primary-700 rounded-full animate-[loading_1.2s_ease-in-out_infinite]" />
      </div>
      <style>{`
        @keyframes loading {
          0%   { width: 0%;   margin-left: 0%; }
          50%  { width: 60%;  margin-left: 20%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}
