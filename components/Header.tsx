export default function Header() {
  return (
    <header className="bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white py-8 px-10 shadow-lg">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo/Brand Section */}
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-br from-[#4a00e0] to-[#8e2de2] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">📄</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              DocTalk
            </h1>
            <p className="text-sm text-gray-300">AI-Powered Document Assistant</p>
          </div>
        </div>
        
        {/* Attribution */}
        <div className="text-sm text-gray-400 hidden md:block">
          Crafted by <span className="text-white font-medium">Piyush Malik</span>
        </div>
        
        {/* Mobile Attribution */}
        <div className="text-xs text-gray-400 md:hidden">
          by <span className="text-white">Piyush Malik</span>
        </div>
      </div>
    </header>
  );
}