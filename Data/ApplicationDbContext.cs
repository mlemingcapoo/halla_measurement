using Microsoft.EntityFrameworkCore;
using Models;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Model> Models { get; set; } = null!;
    public DbSet<ModelSpecification> ModelSpecifications { get; set; } = null!;
    public DbSet<Product> Products { get; set; } = null!;
    public DbSet<Measurement> Measurements { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Indexes
        modelBuilder.Entity<Model>()
            .HasIndex(m => m.ModelCode)
            .IsUnique();

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.MeasurementDate);

        modelBuilder.Entity<Measurement>()
            .HasIndex(m => m.MeasuredAt);

        // Relationships
        modelBuilder.Entity<ModelSpecification>()
            .HasOne(ms => ms.Model)
            .WithMany(m => m.Specifications)
            .HasForeignKey(ms => ms.ModelId);

        modelBuilder.Entity<Product>()
            .HasOne(p => p.Model)
            .WithMany(m => m.Products)
            .HasForeignKey(p => p.ModelId);

        modelBuilder.Entity<Measurement>()
            .HasOne(m => m.Product)
            .WithMany(p => p.Measurements)
            .HasForeignKey(m => m.ProductId);

        modelBuilder.Entity<Measurement>()
            .HasOne(m => m.Specification)
            .WithMany()
            .HasForeignKey(m => m.SpecId);
    }
} 