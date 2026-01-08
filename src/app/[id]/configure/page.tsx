import Dashboard from '@/components/Dashboard';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProfileConfigure({ params }: PageProps) {
  const { id } = await params;
  return <Dashboard profileId={id} />;
}
