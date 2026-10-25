"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import ProductForm from "../../ProductForm";

export default function EditProductPage() {
  const params = useParams();
  const id = params?.id as string;
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function loadProduct() {
      try {
        setLoading(true);
        const res = await fetch(`/api/online/products/${id}`);
        if (!res.ok) {
          throw new Error(`Failed to load product data (Status ${res.status})`);
        }

        let data: any = null;
        try {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            data = await res.json();
          } else {
            throw new Error("Invalid response format received from server");
          }
        } catch (jsonErr: unknown) {
          throw new Error("Could not parse product data. Please refresh and try again.");
        }

        // Parse images properly into an array of image strings
        let imagesArray: string[] = [];
        try {
          const parsed = JSON.parse(data.images);
          if (Array.isArray(parsed)) {
            imagesArray = parsed.map((img: any) => String(img).trim()).filter(Boolean);
          } else if (typeof parsed === "string" && parsed.trim()) {
            imagesArray = [parsed.trim()];
          }
        } catch {
          if (typeof data.images === "string" && data.images.trim()) {
            if (data.images.startsWith("data:")) {
              imagesArray = [data.images.trim()];
            } else {
              imagesArray = data.images.split(",").map((s: string) => s.trim()).filter(Boolean);
            }
          }
        }

        setProduct({
          ...data,
          images: imagesArray,
        });
      } catch (err: unknown) {
        const rawMsg = err instanceof Error ? err.message : "Failed to load product";
        const cleanMsg =
          rawMsg.includes("did not match the expected pattern") || rawMsg.includes("Unexpected token")
            ? "Could not load trouser details. Please refresh the page or try again."
            : rawMsg;
        setError(cleanMsg);
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        <p className="text-sm text-gray-500">Loading product information...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
        {error || "Product not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Edit Product: {product.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Update product specifications, prices, and catalog status.
        </p>
      </div>

      <ProductForm initialData={product} isEdit productId={id} />
    </div>
  );
}
