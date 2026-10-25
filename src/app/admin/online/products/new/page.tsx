"use client";

import ProductForm from "../ProductForm";

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Add New Product
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a new catalog item with pricing, images, and inventory.
        </p>
      </div>

      <ProductForm />
    </div>
  );
}
