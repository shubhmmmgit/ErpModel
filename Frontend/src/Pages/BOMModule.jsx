import { useEffect, useState } from "react";
import { apiFetch } from "../api";
export default function BOMModule() {
  const [boms, setBoms] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [items, setItems] = useState([]);
useEffect(() => {
  console.log("ITEMS STATE:", items);
}, [items]);

  useEffect(() => {
    fetchProducts();
    fetchBoms();
  }, []);

  const fetchProducts = async () => {
    try {
     const data = await apiFetch("/api/bom/products");
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBoms = async () => {
    try {
      const data = await apiFetch("/api/bom");
      setBoms(data);
    } catch (err) {
      console.error(err);
    }
  };

  const addItem = () => {
      console.log("ADD ITEM CLICKED");

    setItems([
      ...items,
        {
      raw_material_id: "",
      quantity_required: 1
    },
    ]);
  };

  const updateItem = (index, field, value) => {
  const copy = [...items];

  copy[index] = {
    ...copy[index],
    [field]: value
  };

  console.log("UPDATED ITEMS:", copy);

  setItems(copy);
};
  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };


  const saveBom = async () => {
    if (!selectedProduct) {
  alert("Select a finished product");
  return;
}

if (items.length === 0) {
  alert("Add at least one ingredient");
  return;
}

for (const item of items) {
  if (!item.raw_material_id) {
    alert("Select ingredient for all rows");
    return;
  }

  if (
  item.quantity_required === "" ||
  item.quantity_required <= 0
) {
    alert("Enter quantity for all rows");
    return;
  }
}
      console.log("SAVE CLICKED");

  console.log("SELECTED PRODUCT:", selectedProduct);

  console.log("CURRENT ITEMS:", items);

  console.log(
    JSON.stringify(
      {
        finished_good_id: Number(selectedProduct),
        items
      },
      null,
      2
    )
  );
    const payload = {
  finished_good_id: Number(selectedProduct),
  items
};

console.log("BOM PAYLOAD:", payload);
    try {
      await apiFetch("/api/bom", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
body: JSON.stringify(payload)
});

      setItems([]);
      setSelectedProduct("");

      fetchBoms();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Bill Of Materials (BOM)
      </h1>

      <div className="bg-white p-4 rounded shadow mb-8">
        <h2 className="font-semibold mb-4">
          Create BOM
        </h2>

        <select
          className="border p-2 w-full mb-4"
          value={selectedProduct}
          onChange={(e) =>
            setSelectedProduct(e.target.value)
          }
        >
          <option value="">
            Select Finished Product
          </option>

          {products.map((p) => (
            <option
              key={p.id}
              value={p.id}
            >
              {p.name}
            </option>
          ))}
        </select>

        {items.map((item, index) => (
          <div
            key={index}
            className="flex gap-3 mb-3"
          >
            <select
  className="border p-2 flex-1"
  value={item.raw_material_id}
  onChange={(e) => {
    console.log("Selected Ingredient:", e.target.value);

    updateItem(
      index,
      "raw_material_id",
      Number(e.target.value)
    );
  }}
>
  <option value="">
    Ingredient
  </option>

  {products.map((p) => (
    <option key={p.id} value={p.id}>
      {p.name}
    </option>
  ))}
</select>
            <input
              type="number"
              className="border p-2 w-40"
              placeholder="Qty"
              value={item.quantity_required}
              onChange={(e) =>
                updateItem(
                  index,
                  "quantity_required",
                  e.target.value
                )
              }
            />

            <button
              onClick={() =>
                removeItem(index)
              }
              className="bg-red-500 text-white px-3 rounded"
            >
              Remove
            </button>
          </div>
        ))}

        <div className="flex gap-3">
          <p className="mb-2 text-blue-600 font-bold">
  Items Count: {items.length}
</p>
          <button
            onClick={addItem}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Add Item
          </button>

          <button
            onClick={saveBom}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Save BOM
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow">
        <div className="p-4 border-b">
          <h2 className="font-semibold">
            Existing BOMs
          </h2>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 text-left">
                Product
              </th>

              <th className="p-3 text-left">
                Ingredients
              </th>

              <th className="p-3 text-left">
                Total Items
              </th>
            </tr>
          </thead>

          <tbody>
            {boms.map((bom) => (
              <tr
                key={bom.id}
                className="border-t"
              >
                <td className="p-3">
                  {bom.product_name}
                </td>

                <td className="p-3">
                  {bom.ingredients}
                </td>

                <td className="p-3">
                  {bom.item_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}