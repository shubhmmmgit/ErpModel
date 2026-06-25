import pool from "../config/db.js";

export const generateDocumentNumber = async (
  businessId,
  documentType
) => {
  const year = new Date().getFullYear();

  // Check if sequence exists
  const existing = await pool.query(
    `
    SELECT *
    FROM document_sequences
    WHERE business_id = $1
    AND document_type = $2
    `,
    [businessId, documentType]
  );

  let nextNumber;

  if (existing.rows.length === 0) {

    await pool.query(
      `
      INSERT INTO document_sequences
      (
        business_id,
        document_type,
        current_number
      )
      VALUES
      ($1,$2,1)
      `,
      [businessId, documentType]
    );

    nextNumber = 1;

  } else {

    nextNumber =
      Number(existing.rows[0].current_number) + 1;

    await pool.query(
      `
      UPDATE document_sequences
      SET current_number = $1
      WHERE business_id = $2
      AND document_type = $3
      `,
      [
        nextNumber,
        businessId,
        documentType
      ]
    );
  }

  return `${documentType}-${year}-${String(nextNumber).padStart(4, "0")}`;
};
