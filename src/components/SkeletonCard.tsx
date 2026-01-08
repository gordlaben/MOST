export default function SkeletonCard() {
  return (
    <div className="bg-gray-800 p-3 md:p-4 rounded-lg border border-gray-700 flex gap-3 md:gap-4 items-center overflow-hidden animate-pulse">
      {/* Poster Skeleton */}
      <div className="w-20 h-[120px] md:w-24 md:h-36 bg-gray-700 rounded shrink-0"></div>
      
      <div className="flex-1 min-w-0 flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title Skeleton */}
          <div className="h-5 bg-gray-700 rounded w-3/4"></div>
          
          {/* Metadata Skeleton */}
          <div className="flex gap-2">
            <div className="h-3 bg-gray-700 rounded w-16"></div>
            <div className="h-3 bg-gray-700 rounded w-20"></div>
          </div>
          
          {/* Date Skeleton */}
          <div className="h-3 bg-gray-700 rounded w-24 mt-1"></div>
          
          {/* Progress Bar Skeleton */}
          <div className="w-full flex flex-col gap-1 mt-2">
            <div className="hidden md:block w-full h-1.5 bg-gray-700 rounded-full"></div>
            <div className="h-2 bg-gray-700 rounded w-12"></div>
          </div>
        </div>

        {/* Buttons Skeleton */}
        <div className="hidden md:flex gap-2 shrink-0">
          <div className="w-9 h-9 bg-gray-700 rounded-lg"></div>
          <div className="w-9 h-9 bg-gray-700 rounded-lg"></div>
        </div>
        
        {/* Mobile Buttons Skeleton */}
        <div className="grid grid-cols-2 gap-2 mt-1 md:hidden w-full">
          <div className="h-8 bg-gray-700 rounded"></div>
          <div className="h-8 bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  );
}
