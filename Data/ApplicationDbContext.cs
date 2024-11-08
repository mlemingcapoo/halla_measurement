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
    public DbSet<Models.Image> Images { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure datetime columns to use datetime2
        modelBuilder.Entity<Model>()
            .Property(m => m.CreatedAt)
            .HasColumnType("datetime2");

        modelBuilder.Entity<Product>()
            .Property(p => p.MeasurementDate)
            .HasColumnType("datetime2");

        modelBuilder.Entity<Measurement>()
            .Property(m => m.MeasuredAt)
            .HasColumnType("datetime2");

        modelBuilder.Entity<Models.Image>()
            .Property(i => i.UploadedAt)
            .HasColumnType("datetime2");

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
            .HasForeignKey(ms => ms.ModelId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Product>()
            .HasOne(p => p.Model)
            .WithMany(m => m.Products)
            .HasForeignKey(p => p.ModelId)
            .OnDelete(DeleteBehavior.Cascade);

        // Both relationships for Measurements set to NoAction
        modelBuilder.Entity<Measurement>()
            .HasOne(m => m.Product)
            .WithMany(p => p.Measurements)
            .HasForeignKey(m => m.ProductId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Measurement>()
            .HasOne(m => m.Specification)
            .WithMany()
            .HasForeignKey(m => m.SpecId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Models.Image>()
            .HasOne(i => i.Model)
            .WithMany(m => m.Images)
            .HasForeignKey(i => i.ModelId)
            .OnDelete(DeleteBehavior.Cascade);
    }
} 