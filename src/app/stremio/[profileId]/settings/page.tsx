import Settings from '@/components/Settings';

interface PageProps {
  params: Promise<{
    profileId: string;
  }>;
}

export default async function ProfileSettings({ params }: PageProps) {
  const { profileId } = await params;
  return <Settings profileId={profileId} />;
}
