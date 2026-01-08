import Dashboard from '@/components/Dashboard';

interface PageProps {
  params: Promise<{
    profileId: string;
  }>;
}

export default async function ProfileConfigure({ params }: PageProps) {
  const { profileId } = await params;
  return <Dashboard profileId={profileId} />;
}
