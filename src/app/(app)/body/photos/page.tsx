import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BodyNav } from "@/components/body/body-nav";
import { PhotoGallery } from "@/components/body/photo-gallery";
import { PhotoUpload } from "@/components/body/photo-upload";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { localDate } from "@/lib/time";
import { requireProfile } from "@/server/auth";
import { listPhotos } from "@/server/body/photos";

export const metadata: Metadata = { title: "Progress photos" };

export default function PhotosPage() {
  return (
    <>
      <PageHeader title="Body" />
      <BodyNav active="/body/photos" />
      <Suspense fallback={<PageSkeleton />}>
        <PhotosContent />
      </Suspense>
    </>
  );
}

async function PhotosContent() {
  const { supabase, profile } = await requireProfile("/body/photos");
  const photos = await listPhotos(supabase);
  const dates = [...new Set(photos.map((p) => p.local_date))];
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Add a progress photo</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoUpload today={localDate(new Date(), profile.timezone)} />
        </CardContent>
      </Card>
      {dates.length >= 2 && (
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href={`/body/photos/compare?a=${dates.at(-1)}&b=${dates[0]}&pose=front`}>Compare photos</Link>
        </Button>
      )}
      <PhotoGallery photos={photos.map(({ id, local_date, pose, url, width, height }) => ({ id, local_date, pose, url, width, height }))} />
    </>
  );
}
