export const createPagination = (total: number, page: number, limit: number, offset: number) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: offset + limit < total,
    hasPrev: offset > 0,
})
