import Settings from '@/components/Settings';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProfileSettings({ params }: PageProps) {
  const { id } = await params;
  return <Settings profileId={id} />;
}
